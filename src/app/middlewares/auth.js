import { normalizeError } from "../errors";
import { AppError } from "../errors";
import jwt from "jsonwebtoken";
import authConfig from "../../config/auth";
import User from "../models/User";

export default async (req, res, next) => {
  try {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "");
    if (!match) throw AppError.fromResponse(401, { error: "Token not valid" });
    let decoded;
    try {
      decoded = jwt.verify(match[1], authConfig.secret, {
        algorithms: ["HS256"],
      });
    } catch {
      throw AppError.fromResponse(401, { error: "Token not valid" });
    }
    if (
      !Number.isSafeInteger(decoded.id) ||
      decoded.id < 1 ||
      !(await User.findByPk(decoded.id))
    ) {
      throw AppError.fromResponse(401, { error: "Token not valid" });
    }
    req.userId = decoded.id;
    return next();
  } catch (error) {
    throw normalizeError(error);
  }
};
