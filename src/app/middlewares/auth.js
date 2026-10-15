import jwt from "jsonwebtoken";
import User from "../models/User";

export default async (req, res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match)
    return res.status(401).json({ error: "Informe um token Bearer." });
  if (!process.env.AUTH_SECRET)
    throw new Error("Configure AUTH_SECRET no .env.");
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.AUTH_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id < 1 || !(await User.findByPk(id))) {
    return res.status(401).json({ error: "Usuário não encontrado." });
  }
  req.userId = id;
  return next();
};
