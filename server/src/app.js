import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import api from "./routes/api.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  // Reject cross-origin mutations, including multipart uploads (CSRF protection).
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      origin &&
      origin !== (process.env.CLIENT_URL || "http://localhost:5173")
    )
      return res.status(403).json({ message: "Request origin is not allowed" });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      message: { message: "Too many requests. Please wait." },
    }),
    api,
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "API endpoint not found" }),
  );
  const dist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
  app.use((err, req, res, next) => {
    if (err.name === "ZodError")
      return res.status(400).json({
        message: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err.code === 11000)
      return res.status(409).json({ message: "This account already exists" });
    if (err.code === "LIMIT_FILE_SIZE")
      return res
        .status(413)
        .json({ message: "Files must be smaller than 20 MB" });
    const status = err.status || 400;
    if (
      !err.status &&
      err.name !== "CastError" &&
      err.name !== "ValidationError"
    ) {
      console.error("Request failed:", err.name);
      return res
        .status(500)
        .json({ message: "Something went wrong. Please try again." });
    }
    res
      .status(status)
      .json({ message: err.status ? err.message : "Invalid request data" });
  });
  return app;
}
