import User from "../models/User";
import jwt from "jsonwebtoken"

class SessionsController {
  async create(req, res) {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Password not match" });
    }

    const { id, name } = user;

    return res.json({
        user: {
            id, name, email
        },
        token: jwt.sign({ id }, "a06d39d9gwejgnwogvwr2452", {
            expiresIn: "7d"
        }),
    })

  }
}

export default SessionsController;
