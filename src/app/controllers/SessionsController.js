import { normalizeError } from "../errors";
import { AppError } from "../errors";
import User from "../models/User";
import jwt from "jsonwebtoken";

import authConfig from "../../config/auth";
import * as Yup from "yup";

class SessionsController {
  async create(req, res) {
    try {
      const schema = Yup.object({
        email: Yup.string().strict().email().required(),
        password: Yup.string().strict().required().max(128),
      });
      if (!(await schema.isValid(req.body ?? {}))) {
        throw AppError.fromResponse(400, {
          error: "Informe email e senha válidos.",
        });
      }
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email },
      });

      if (!user) {
        throw AppError.fromResponse(401, {
          error: "Email ou senha incorretos.",
        });
      }

      if (!(await user.checkPassword(password))) {
        throw AppError.fromResponse(401, {
          error: "Email ou senha incorretos.",
        });
      }

      const { id, name } = user;

      return res.json({
        user: {
          id,
          name,
          email,
        },
        token: jwt.sign({ id }, authConfig.secret, {
          expiresIn: authConfig.expiresIn,
        }),
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default SessionsController;
