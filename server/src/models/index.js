import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const options = { timestamps: true };
export const STATUSES = [
  "NEW_LEAD",
  "CLAIMED",
  "INVESTIGATING",
  "EDITOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
];
export const Organization = model(
  "Organization",
  new Schema(
    { name: { type: String, required: true }, description: String },
    options,
  ),
);
export const User = model(
  "User",
  new Schema(
    {
      fullName: String,
      email: { type: String, unique: true, required: true },
      passwordHash: { type: String, select: false },
      organization: ref("Organization"),
      designation: String,
      location: String,
      professionalInfo: String,
      role: {
        type: String,
        enum: ["journalist", "editor", "admin"],
        default: "journalist",
      },
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      verificationFeedback: String,
      active: { type: Boolean, default: true },
      tokenVersion: { type: Number, default: 0 },
    },
    options,
  ),
);
export const Story = model(
  "Story",
  new Schema(
    {
      organization: ref("Organization"),
      title: String,
      description: String,
      category: String,
      location: String,
      priority: {
        type: String,
        enum: ["Low", "Medium", "High"],
        default: "Medium",
      },
      priorityRank: Number,
      incidentAt: Date,
      submittedBy: ref("User"),
      investigator: ref("User", false),
      claimedAt: Date,
      status: { type: String, enum: STATUSES, default: "NEW_LEAD" },
      draft: { headline: String, body: String, summary: String, facts: String },
      image: { url: String, publicId: String },
      history: [
        {
          status: String,
          actor: ref("User"),
          at: { type: Date, default: Date.now },
        },
      ],
    },
    options,
  ),
);
export const Source = model(
  "Source",
  new Schema(
    {
      story: ref("Story"),
      addedBy: ref("User"),
      title: String,
      url: String,
      type: String,
      notes: String,
    },
    options,
  ),
);
export const Evidence = model(
  "Evidence",
  new Schema(
    {
      story: ref("Story"),
      addedBy: ref("User"),
      title: String,
      url: String,
      publicId: String,
      resourceType: String,
      format: String,
      bytes: Number,
    },
    options,
  ),
);
export const Investigation = model(
  "Investigation",
  new Schema(
    {
      story: { ...ref("Story"), unique: true },
      journalist: ref("User"),
      notes: [{ text: String, createdAt: { type: Date, default: Date.now } }],
    },
    options,
  ),
);
export const EditorReview = model(
  "EditorReview",
  new Schema(
    {
      story: ref("Story"),
      editor: ref("User"),
      decision: String,
      feedback: String,
    },
    options,
  ),
);
Story.schema.index({ organization: 1, status: 1, createdAt: -1 });
