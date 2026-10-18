import jwt from "jsonwebtoken";
import authConfig from "../../config/auth";
import User from "../models/User";

export default async (req, res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return res.status(401).json({ error: "Token not valid" });
  let decoded;
  try {
    decoded = jwt.verify(match[1], authConfig.secret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Token not valid" });
  }
  if (!Number.isSafeInteger(decoded.id) || decoded.id < 1 || !(await User.findByPk(decoded.id))) {
    return res.status(401).json({ error: "Token not valid" });
  }
  req.userId = decoded.id;
  return next();
};
