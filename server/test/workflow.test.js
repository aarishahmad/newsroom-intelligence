import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { Organization, User, Story } from "../src/models/index.js";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.CLIENT_URL = "http://localhost:5173";
let org, other, admin, editor, reporter, second, app;
const agent = () => request.agent(app);
async function login(email) {
  const a = agent();
  await a
    .post("/api/auth/login")
    .send({ email, password: "TestPassword123!" })
    .expect(200);
  return a;
}
before(async () => {
  await mongoose.connect(
    process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27028/newsroom_test",
    { dbName: `newsroom_test_${Date.now()}` },
  );
  app = createApp();
  org = await Organization.create({ name: "Test newsroom" });
  other = await Organization.create({ name: "Other newsroom" });
  const hash = await bcrypt.hash("TestPassword123!", 4);
  for (const [email, role, organization] of [
    ["admin@test.example", "admin", org._id],
    ["editor@test.example", "editor", org._id],
    ["second@test.example", "journalist", org._id],
    ["other@test.example", "journalist", other._id],
  ])
    await User.create({
      email,
      role,
      organization,
      fullName: email,
      passwordHash: hash,
      verificationStatus: "verified",
    });
  admin = await login("admin@test.example");
  editor = await login("editor@test.example");
  second = await login("second@test.example");
});
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test("real MongoDB workflow, permissions, atomic claims, revisions and publication", async () => {
  reporter = agent();
  const registration = await reporter
    .post("/api/auth/register")
    .send({
      fullName: "Test Journalist",
      email: "new@test.example",
      password: "TestPassword123!",
      organization: String(org._id),
      designation: "Reporter",
      location: "Lucknow",
      role: "admin",
      verificationStatus: "verified",
    })
    .expect(201);
  const user = registration.body;
  assert.equal(user.role, "journalist");
  assert.equal(user.verificationStatus, "pending");
  assert.equal(user.passwordHash, undefined);
  await reporter.get("/api/stories").expect(403);
  await reporter.post("/api/stories").send({}).expect(403);
  await reporter
    .patch(`/api/users/${user._id}`)
    .send({ verificationStatus: "verified" })
    .expect(403);
  await admin
    .patch(`/api/users/${user._id}`)
    .send({
      verificationStatus: "rejected",
      verificationFeedback: "Please resubmit",
    })
    .expect(200);
  await reporter.get("/api/auth/me").expect(401);
  reporter = await login("new@test.example");
  await reporter.post("/api/users/verification-request").expect(200);
  await admin
    .patch(`/api/users/${user._id}`)
    .send({ verificationStatus: "verified" })
    .expect(200);
  reporter = await login("new@test.example");
  const lead = {
    title: "Water testing records need review",
    description:
      "Residents report missing testing records. Obtain the original logs before drawing conclusions.",
    category: "Environment",
    priority: "High",
    location: "Lucknow",
  };
  await reporter
    .post("/api/stories")
    .send({ ...lead, title: "x" })
    .expect(400);
  const created = await reporter.post("/api/stories").send(lead).expect(201);
  const id = created.body._id;
  assert.equal(created.body.status, "NEW_LEAD");
  await reporter
    .get("/api/stories?search=Water&priority=High")
    .expect(200)
    .then((r) => assert.equal(r.body.length, 1));
  const outsider = await login("other@test.example");
  await outsider.get(`/api/stories/${id}`).expect(404);
  await outsider
    .get("/api/stories")
    .expect(200)
    .then((r) => assert.equal(r.body.length, 0));
  const attempts = await Promise.all([
    reporter.post(`/api/stories/${id}/claim`),
    second.post(`/api/stories/${id}/claim`),
  ]);
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
  const investigator = attempts[0].status === 200 ? reporter : second;
  const nonOwner = attempts[0].status === 200 ? second : reporter;
  await nonOwner
    .post(`/api/stories/${id}/notes`)
    .send({ text: "Unauthorized" })
    .expect(403);
  await investigator.post(`/api/stories/${id}/start`).expect(200);
  await investigator
    .post(`/api/stories/${id}/notes`)
    .send({ text: "Requested original testing logs from the department." })
    .expect(201);
  await investigator
    .post(`/api/stories/${id}/sources`)
    .send({
      title: "Unsafe source",
      url: "javascript:alert(1)",
      type: "Website",
    })
    .expect(400);
  await investigator
    .post(`/api/stories/${id}/sources`)
    .send({
      title: "Department statement",
      type: "Government source",
      url: "https://example.org/statement",
      notes: "Demonstration source",
    })
    .expect(201);
  await investigator
    .post(`/api/stories/${id}/evidence`)
    .field("title", "Invalid file")
    .attach("file", Buffer.from("<html>unsafe</html>"), "fake.png")
    .expect(400);
  await investigator
    .post(`/api/stories/${id}/evidence`)
    .field("title", "Demo PDF")
    .attach("file", Buffer.from("%PDF-1.4\nDemo"), "demo.pdf")
    .expect(503);
  await investigator
    .post(`/api/ai/story-brief`)
    .send({ storyId: id })
    .expect(503);
  await investigator.post(`/api/stories/${id}/submit-review`).expect(400);
  await investigator
    .put(`/api/stories/${id}/draft`)
    .send({
      headline: "Water testing records raise questions",
      body: "The newsroom requested original records. The reported gaps have not yet been independently confirmed.",
      summary: "A review of reported record gaps.",
      facts: "Attributed claims only.",
    })
    .expect(200);
  await investigator.post(`/api/stories/${id}/submit-review`).expect(200);
  await investigator.post(`/api/editor/reviews/${id}/approve`).expect(403);
  await investigator
    .post(`/api/stories/${id}/notes`)
    .send({ text: "Locked" })
    .expect(409);
  await editor.post(`/api/editor/reviews/${id}/publish`).expect(409);
  await editor
    .post(`/api/editor/reviews/${id}/request-changes`)
    .send({ feedback: "" })
    .expect(400);
  await editor
    .post(`/api/editor/reviews/${id}/request-changes`)
    .send({ feedback: "Include the department response." })
    .expect(200);
  await investigator.post(`/api/stories/${id}/submit-review`).expect(200);
  await editor
    .post(`/api/editor/reviews/${id}/approve`)
    .send({ feedback: "Ready for publication." })
    .expect(200);
  await editor.post(`/api/editor/reviews/${id}/publish`).expect(200);
  const result = await investigator.get(`/api/stories/${id}`).expect(200);
  assert.equal(result.body.story.status, "PUBLISHED");
  assert.equal(result.body.sources.length, 1);
  assert.equal(result.body.investigation.notes.length, 1);
  assert.equal(result.body.reviews.length, 3);
  await reporter
    .post("/api/stories")
    .set("Origin", "https://attacker.example")
    .send(lead)
    .expect(403);
  await reporter.post("/api/auth/logout").expect(200);
  await reporter.get("/api/auth/me").expect(401);
});
test("rejecting a story is terminal and suspended users lose access", async () => {
  const journalist = await login("second@test.example");
  const story = await Story.create({
    organization: org._id,
    title: "Review rejection example",
    status: "EDITOR_REVIEW",
    submittedBy: (await User.findOne({ email: "second@test.example" }))._id,
  });
  await editor
    .post(`/api/editor/reviews/${story._id}/reject`)
    .send({ feedback: "Evidence does not support publication." })
    .expect(200);
  await editor.post(`/api/editor/reviews/${story._id}/approve`).expect(409);
  const user = await User.findOne({ email: "second@test.example" });
  await admin
    .patch(`/api/users/${user._id}`)
    .send({ active: false })
    .expect(200);
  await journalist.get("/api/stories").expect(401);
});
