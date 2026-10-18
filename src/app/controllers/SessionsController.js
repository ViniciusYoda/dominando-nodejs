import User from "../models/User";
import jwt from "jsonwebtoken"

import authConfig from "../../config/auth"
import * as Yup from "yup";

class SessionsController {
  async create(req, res) {
    const schema = Yup.object({
      email: Yup.string().strict().email().required(),
      password: Yup.string().strict().required().max(128),
    });
    if (!(await schema.isValid(req.body ?? {}))) {
      return res.status(400).json({ error: "Informe email e senha válidos." });
    }
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Email ou senha incorretos." });
    }

    if (!(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Email ou senha incorretos." });
    }

    const { id, name } = user;

    return res.json({
        user: {
            id, name, email
        },
        token: jwt.sign({ id }, authConfig.secret, {
            expiresIn: authConfig.expiresIn
        }),
    })

  }
}

export default SessionsController;
