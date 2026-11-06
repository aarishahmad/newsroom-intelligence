import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw fail(401, "Please log in to continue");
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.active || user.tokenVersion !== payload.version)
    throw fail(401, "Your session has ended. Please log in again");
  return user;
}
export async function auth(req, res, next) {
  try {
    req.user = await authenticateToken(req.cookies.session);
    next();
  } catch (e) {
    next(e);
  }
}
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : next(fail(403, "You are not authorized to perform this action"));
export function verified(req, res, next) {
  if (
    req.user.role === "journalist" &&
    req.user.verificationStatus !== "verified"
  )
    return next(
      fail(403, "Only verified journalists can access this workspace"),
    );
  next();
}
