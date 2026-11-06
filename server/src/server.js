import mongoose from "mongoose";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { authenticateToken } from "./middleware/auth.js";
if (
  !process.env.MONGODB_URI ||
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32
)
  throw new Error(
    "Configure MONGODB_URI and a JWT_SECRET of at least 32 characters in server/.env",
  );
await mongoose.connect(process.env.MONGODB_URI);
const app = createApp();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});
app.set("io", io);
io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie || "";
    const token = cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("session="))
      ?.slice(8);
    socket.user = await authenticateToken(token);
    if (
      socket.user.role === "journalist" &&
      socket.user.verificationStatus !== "verified"
    )
      throw new Error();
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (socket) => {
  socket.join(`org:${socket.user.organization}`);
  socket.join(`user:${socket.user._id}`);
  const timer = setInterval(async () => {
    try {
      await authenticateToken(
        (socket.handshake.headers.cookie || "")
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("session="))
          ?.slice(8),
      );
    } catch {
      socket.disconnect(true);
    }
  }, 60000);
  socket.on("disconnect", () => clearInterval(timer));
});
server.listen(process.env.PORT || 4000, "127.0.0.1", () =>
  console.log(
    `Newsroom API ready on http://localhost:${process.env.PORT || 4000}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    io.close();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
