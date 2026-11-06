import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Organization, User, Story, Source } from "./models/index.js";
if (process.env.NODE_ENV === "production")
  throw new Error("Demo seed is disabled in production");
if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in server/.env");
await mongoose.connect(process.env.MONGODB_URI);
const org = await Organization.findOneAndUpdate(
  { name: "The Daily Ledger" },
  {
    $setOnInsert: {
      description:
        "An independent demonstration newsroom. All stories and people are fictional.",
    },
  },
  { upsert: true, new: true },
);
const accounts = [
  ["admin", "Morgan Admin", "admin"],
  ["editor", "Alex Editor", "editor"],
  ["journalist", "Jamie Reporter", "journalist"],
  ["journalist2", "Taylor Correspondent", "journalist"],
  ["journalist3", "Casey Reporter", "journalist"],
];
const users = [];
for (const [name, fullName, role] of accounts)
  users.push(
    await User.findOneAndUpdate(
      { email: `${name}@newsroom.test` },
      {
        $setOnInsert: {
          fullName,
          role,
          organization: org._id,
          passwordHash: await bcrypt.hash("NewsroomDemo123!", 12),
          verificationStatus: "verified",
          designation: role === "journalist" ? "Staff reporter" : role,
          location: "Lucknow",
        },
      },
      { upsert: true, new: true },
    ),
  );
const leads = [
  [
    "City water audit reveals gaps in neighborhood testing",
    "Environment",
    "High",
    "Lucknow",
    "A fictional community group reports missing water-quality records across three neighborhoods. Request the original testing logs and speak with the municipal water board.",
  ],
  [
    "Public library extension faces a funding delay",
    "Local",
    "Medium",
    "Lucknow",
    "Residents report a delay to the proposed library extension. The project budget, procurement schedule, and council response need to be obtained.",
  ],
  [
    "Small businesses question changes to market permits",
    "Business",
    "High",
    "Delhi",
    "A fictional traders association has raised concerns about new market permit requirements. Compare written rules with accounts from affected vendors.",
  ],
  [
    "Rural schools pilot a shared science laboratory",
    "Education",
    "Low",
    "Kanpur",
    "Three demonstration schools are reportedly sharing laboratory equipment. Investigate access, funding and student participation before drawing conclusions.",
  ],
  [
    "Community clinic extends evening consultation hours",
    "Health",
    "Medium",
    "Lucknow",
    "A local clinic has announced additional evening appointments. Confirm staffing, eligibility and how residents can access the service.",
  ],
  [
    "New bus route could connect eastern neighborhoods",
    "Local",
    "Low",
    "Delhi",
    "A proposed bus route appears in a fictional consultation document. Ask the transport department about route selection and public feedback.",
  ],
];
for (const [title, category, priority, location, description] of leads) {
  const story = await Story.findOneAndUpdate(
    { organization: org._id, title },
    {
      $setOnInsert: {
        category,
        priority,
        priorityRank: { Low: 1, Medium: 2, High: 3 }[priority],
        location,
        description,
        submittedBy: users[2]._id,
        history: [{ status: "NEW_LEAD", actor: users[2]._id }],
      },
    },
    { upsert: true, new: true },
  );
  await Source.findOneAndUpdate(
    { story: story._id, title: "Initial reporting tip" },
    {
      $setOnInsert: {
        addedBy: users[2]._id,
        type: "Interview",
        notes: "Fictional demo tip. No claim has been independently confirmed.",
      },
    },
    { upsert: true },
  );
}
console.log(
  "Demo data ready. See README for fictional demo accounts. Existing data was preserved.",
);
await mongoose.disconnect();
