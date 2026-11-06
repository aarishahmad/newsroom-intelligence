import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import {
  Organization,
  User,
  Story,
  Source,
  Evidence,
  Investigation,
  EditorReview,
  STATUSES,
} from "../models/index.js";
import { auth, roles, verified, fail } from "../middleware/auth.js";
import { upload, assist } from "../services/integrations.js";
const router = Router();
const text = (min = 1, max = 500) => z.string().trim().min(min).max(max);
const id = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), "Invalid identifier");
const url = z
  .union([
    z.literal(""),
    z.url().refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS URL"),
  ])
  .optional();
const sourceSchema = z.object({
  title: text(2, 200),
  url,
  type: z.enum([
    "Website",
    "Government source",
    "Police statement",
    "Company statement",
    "Interview",
    "Previous news report",
  ]),
  notes: text(0, 5000).optional(),
});
const storySchema = z.object({
  title: text(5, 180),
  description: text(20, 5000),
  category: z.enum([
    "Local",
    "Politics",
    "Environment",
    "Business",
    "Health",
    "Education",
    "Technology",
  ]),
  location: text(2, 120),
  priority: z.enum(["Low", "Medium", "High"]),
  incidentAt: z.iso.datetime().optional(),
  initialSource: sourceSchema.optional(),
});
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
});
function session(res, user) {
  res.cookie(
    "session",
    jwt.sign(
      { sub: String(user._id), version: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" },
    ),
    cookieOptions(),
  );
}
function publicUser(user) {
  const value = user.toObject();
  delete value.passwordHash;
  delete value.tokenVersion;
  return value;
}
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});
router.get("/organizations", async (req, res) =>
  res.json(await Organization.find().select("name").sort("name")),
);
router.post("/auth/register", authLimit, async (req, res) => {
  const data = z
    .object({
      fullName: text(2, 100),
      email: z.email().transform((v) => v.toLowerCase()),
      password: z
        .string()
        .min(10)
        .max(72)
        .refine(
          (v) => Buffer.byteLength(v) <= 72,
          "Password must be at most 72 bytes",
        ),
      organization: id,
      designation: text(2, 100),
      location: text(2, 120),
      professionalInfo: text(0, 2000).optional(),
    })
    .parse(req.body);
  if (!(await Organization.exists({ _id: data.organization })))
    throw fail(400, "Organization not found");
  const { password, ...profile } = data;
  const user = await User.create({
    ...profile,
    passwordHash: await bcrypt.hash(password, 12),
  });
  session(res, user);
  res.status(201).json(publicUser(user));
});
router.post("/auth/login", authLimit, async (req, res) => {
  const data = z
    .object({ email: z.email(), password: z.string().min(1).max(100) })
    .parse(req.body);
  const user = await User.findOne({
    email: data.email.toLowerCase(),
    active: true,
  }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
    throw fail(401, "Invalid credentials");
  session(res, user);
  res.json(publicUser(user));
});
router.use(auth);
router.get("/auth/me", async (req, res) =>
  res.json(
    publicUser(await req.user.populate("organization", "name description")),
  ),
);
router.post("/auth/logout", async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  req.app.get("io")?.in(`user:${req.user._id}`).disconnectSockets();
  res.clearCookie("session", cookieOptions());
  res.json({ message: "Logged out" });
});
router.post(
  "/users/verification-request",
  roles("journalist"),
  async (req, res) => {
    if (req.user.verificationStatus === "verified")
      throw fail(409, "You are already verified");
    req.user.verificationStatus = "pending";
    req.user.verificationFeedback = "";
    await req.user.save();
    res.json(publicUser(req.user));
  },
);
router.get("/users", roles("admin"), async (req, res) =>
  res.json(
    await User.find({ organization: req.user.organization })
      .select("-tokenVersion")
      .sort({ createdAt: -1 }),
  ),
);
router.patch("/users/:id", roles("admin"), async (req, res) => {
  const data = z
    .object({
      verificationStatus: z.enum(["verified", "rejected"]).optional(),
      active: z.boolean().optional(),
      verificationFeedback: text(0, 1000).optional(),
    })
    .parse(req.body);
  const user = await User.findOne({
    _id: id.parse(req.params.id),
    organization: req.user.organization,
    role: "journalist",
  });
  if (!user) throw fail(404, "Journalist not found");
  Object.assign(user, data);
  user.tokenVersion++;
  await user.save();
  req.app.get("io")?.in(`user:${user._id}`).disconnectSockets();
  res.json(publicUser(user));
});
router.use(verified);
async function getStory(req) {
  const story = await Story.findOne({
    _id: id.parse(req.params.id || req.body?.storyId),
    organization: req.user.organization,
  });
  if (!story) throw fail(404, "Story not found");
  return story;
}
function owner(req, story) {
  if (
    req.user.role !== "journalist" ||
    String(story.investigator) !== String(req.user._id)
  )
    throw fail(403, "Only the assigned journalist can edit this investigation");
  if (!["CLAIMED", "INVESTIGATING", "CHANGES_REQUESTED"].includes(story.status))
    throw fail(409, "This story is not open for investigation edits");
}
function notify(req, story) {
  req.app.get("io")?.to(`org:${req.user.organization}`).emit("story:updated", {
    id: story._id,
    title: story.title,
    status: story.status,
    investigator: req.user.fullName,
  });
}
async function transition(req, story, from, to, extra = {}) {
  const updated = await Story.findOneAndUpdate(
    { _id: story._id, status: { $in: from } },
    {
      $set: { status: to, ...extra },
      $push: { history: { status: to, actor: req.user._id, at: new Date() } },
    },
    { new: true },
  );
  if (!updated)
    throw fail(
      409,
      "Story changed or this action is not valid for its current status",
    );
  notify(req, updated);
  return updated;
}
router.get("/stories", async (req, res) => {
  const query = { organization: req.user.organization };
  for (const key of ["category", "location", "priority", "status"])
    if (req.query[key]) query[key] = String(req.query[key]);
  if (req.query.mine === "true") query.investigator = req.user._id;
  if (req.query.search) {
    const safe = String(req.query.search)
      .slice(0, 150)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
    ];
  }
  res.json(
    await Story.find(query)
      .populate("submittedBy investigator", "fullName")
      .sort(
        req.query.sort === "priority"
          ? { priorityRank: -1, createdAt: -1 }
          : { createdAt: -1 },
      )
      .limit(200),
  );
});
router.post("/stories", roles("journalist"), async (req, res) => {
  const { initialSource, ...data } = storySchema.parse(req.body);
  const story = await Story.create({
    ...data,
    priorityRank: { Low: 1, Medium: 2, High: 3 }[data.priority],
    organization: req.user.organization,
    submittedBy: req.user._id,
    history: [{ status: "NEW_LEAD", actor: req.user._id }],
  });
  if (initialSource)
    await Source.create({
      ...initialSource,
      story: story._id,
      addedBy: req.user._id,
    });
  notify(req, story);
  res.status(201).json(story);
});
router.get("/stories/:id", async (req, res) => {
  const story = await getStory(req);
  await story.populate("submittedBy investigator", "fullName");
  const [sources, evidence, investigation, reviews] = await Promise.all([
    Source.find({ story: story._id }).populate("addedBy", "fullName"),
    Evidence.find({ story: story._id }),
    Investigation.findOne({ story: story._id }),
    EditorReview.find({ story: story._id })
      .populate("editor", "fullName")
      .sort({ createdAt: -1 }),
  ]);
  res.json({ story, sources, evidence, investigation, reviews });
});
router.post("/stories/:id/claim", roles("journalist"), async (req, res) => {
  const story = await getStory(req);
  const updated = await transition(req, story, ["NEW_LEAD"], "CLAIMED", {
    investigator: req.user._id,
    claimedAt: new Date(),
  });
  await Investigation.updateOne(
    { story: story._id },
    { $setOnInsert: { journalist: req.user._id, notes: [] } },
    { upsert: true },
  );
  res.json(updated);
});
router.post("/stories/:id/start", roles("journalist"), async (req, res) => {
  const story = await getStory(req);
  owner(req, story);
  res.json(await transition(req, story, ["CLAIMED"], "INVESTIGATING"));
});
router.put("/stories/:id/draft", roles("journalist"), async (req, res) => {
  const story = await getStory(req);
  owner(req, story);
  const draft = z
    .object({
      headline: text(0, 180),
      body: text(0, 100000),
      summary: text(0, 3000),
      facts: text(0, 10000),
    })
    .parse(req.body);
  const updated = await Story.findOneAndUpdate(
    { _id: story._id, status: story.status },
    { $set: { draft } },
    { new: true },
  );
  if (!updated) throw fail(409, "Story changed. Reload before editing.");
  res.json(updated);
});
router.post("/stories/:id/notes", roles("journalist"), async (req, res) => {
  const story = await getStory(req);
  owner(req, story);
  const data = z.object({ text: text(1, 10000) }).parse(req.body);
  res
    .status(201)
    .json(
      await Investigation.findOneAndUpdate(
        { story: story._id },
        { $setOnInsert: { journalist: req.user._id }, $push: { notes: data } },
        { upsert: true, new: true },
      ),
    );
});
router.post("/stories/:id/sources", roles("journalist"), async (req, res) => {
  const story = await getStory(req);
  owner(req, story);
  res.status(201).json(
    await Source.create({
      ...sourceSchema.parse(req.body),
      story: story._id,
      addedBy: req.user._id,
    }),
  );
});
const files = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});
router.post(
  "/stories/:id/evidence",
  roles("journalist"),
  async (req, res, next) => {
    const story = await getStory(req);
    owner(req, story);
    req.story = story;
    next();
  },
  files.single("file"),
  async (req, res) => {
    const title = text(2, 200).parse(req.body.title);
    if (!req.file) throw fail(400, "Choose an image, PDF, or MP4 file");
    // Inspect signatures rather than trusting the browser's MIME type.
    const b = req.file.buffer;
    const isPng = b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
    const isPdf = b.subarray(0, 5).toString() === "%PDF-";
    const isMp4 = b.subarray(4, 8).toString() === "ftyp";
    if (!isPng && !isJpeg && !isPdf && !isMp4)
      throw fail(400, "Supported files: PNG, JPEG, PDF, MP4 (maximum 20 MB)");
    const result = await upload(b);
    res.status(201).json(
      await Evidence.create({
        story: req.story._id,
        addedBy: req.user._id,
        title,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format,
        bytes: result.bytes,
      }),
    );
  },
);
router.post(
  "/stories/:id/image",
  roles("journalist"),
  async (req, res, next) => {
    const story = await getStory(req);
    if (
      String(story.submittedBy) !== String(req.user._id) ||
      story.status !== "NEW_LEAD"
    )
      throw fail(403, "Only the author can add an image to a new lead");
    req.story = story;
    next();
  },
  files.single("file"),
  async (req, res) => {
    const b = req.file?.buffer;
    if (
      !b ||
      !(
        (b[0] === 255 && b[1] === 216 && b[2] === 255) ||
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
    )
      throw fail(400, "Choose a PNG or JPEG image");
    const result = await upload(b);
    req.story.image = { url: result.secure_url, publicId: result.public_id };
    await req.story.save();
    res.json(req.story);
  },
);
router.post(
  "/stories/:id/submit-review",
  roles("journalist"),
  async (req, res) => {
    const story = await getStory(req);
    owner(req, story);
    if (!story.draft?.headline || !story.draft?.body?.trim())
      throw fail(400, "Save a headline and article body before submitting");
    res.json(
      await transition(
        req,
        story,
        ["INVESTIGATING", "CHANGES_REQUESTED"],
        "EDITOR_REVIEW",
      ),
    );
  },
);
router.get("/editor/reviews", roles("editor"), async (req, res) =>
  res.json(
    await Story.find({
      organization: req.user.organization,
      status: {
        $in: [
          "EDITOR_REVIEW",
          "INVESTIGATING",
          "CHANGES_REQUESTED",
          "APPROVED",
        ],
      },
    })
      .populate("investigator", "fullName")
      .sort({ updatedAt: -1 }),
  ),
);
router.post(
  "/editor/reviews/:id/:action",
  roles("editor"),
  async (req, res) => {
    const story = await getStory(req);
    const actions = {
      approve: ["EDITOR_REVIEW", "APPROVED"],
      "request-changes": ["EDITOR_REVIEW", "CHANGES_REQUESTED"],
      reject: ["EDITOR_REVIEW", "REJECTED"],
      publish: ["APPROVED", "PUBLISHED"],
    };
    const action = actions[req.params.action];
    if (!action) throw fail(404, "Review action not found");
    const feedback = text(
      req.params.action === "request-changes" || req.params.action === "reject"
        ? 5
        : 0,
      5000,
    ).parse(req.body?.feedback || "");
    const updated = await transition(req, story, [action[0]], action[1]);
    await EditorReview.create({
      story: story._id,
      editor: req.user._id,
      decision: action[1],
      feedback,
    });
    res.json(updated);
  },
);
router.post(
  "/ai/:task",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    message: { message: "Please wait before requesting more AI suggestions." },
  }),
  async (req, res) => {
    const tasks = {
      "story-brief": "Create a story brief",
      "investigation-questions":
        "Generate investigation and interview questions",
      summarize: "Summarize the supplied documents or multiple sources",
      "extract-facts":
        "Extract important attributed claims and missing information",
    };
    if (!tasks[req.params.task]) throw fail(404, "AI task not found");
    const story = await getStory(req);
    const input = text(0, 30000).parse(req.body.text || "");
    const sources = await Source.find({ story: story._id });
    res.json({
      label: "AI-generated suggestions — not verified facts",
      text: await assist(
        tasks[req.params.task],
        JSON.stringify({
          title: story.title,
          description: story.description,
          draft: story.draft,
          sources,
          text: input,
        }),
      ),
    });
  },
);
export default router;
