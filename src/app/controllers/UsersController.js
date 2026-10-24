import { normalizeError } from "../errors";
import { AppError } from "../errors";
import { isValid, parseISO } from "date-fns";
import { Op } from "sequelize";
import * as Yup from "yup";
import User from "../models/User";
import { hashPassword, checkPassword } from "../lib/password";
import Queue from "../lib/Queue";
import WelcomeMail from "../jobs/WelcomeMail";
import monitoring from "../../lib/monitoring";

const publicFields = ["id", "name", "email", "createdAt", "updatedAt"];
function publicUser(user) {
  const data = user.get({ plain: true });
  return Object.fromEntries(publicFields.map((field) => [field, data[field]]));
}

function validId(value) {
  return (
    typeof value === "string" &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}

function userSchema(required) {
  const text = () =>
    Yup.string().transform((value, original) =>
      typeof original === "string" ? original.trim() : original
    );
  const fields = {
    name: text()
      .typeError("name deve ser um texto.")
      .min(1, "name não pode ser vazio.")
      .max(255),
    email: text()
      .typeError("email deve ser um texto.")
      .min(1, "email não pode ser vazio.")
      .email("Informe um email válido.")
      .max(255),
    password: Yup.string()
      .strict()
      .typeError("password deve ser um texto.")
      .min(8, "password deve ter ao menos 8 caracteres.")
      .max(128),
  };
  if (required) {
    for (const field of Object.keys(fields)) {
      fields[field] = fields[field].required(`${field} é obrigatório.`);
    }
    fields.confirmPassword = Yup.string()
      .strict()
      .required("Confirme a senha em confirmPassword.")
      .oneOf([Yup.ref("password")], "As senhas devem ser iguais.");
  } else {
    fields.oldPassword = Yup.string()
      .strict()
      .max(128)
      .when("password", {
        is: (password) => password !== undefined,
        then: (schema) =>
          schema.required("Informe a senha atual em oldPassword."),
      });
  }
  return Yup.object(fields).test(
    "has-fields",
    "Informe name, email ou password.",
    (data) =>
      data &&
      [data.name, data.email, data.password].some(
        (value) => value !== undefined
      )
  );
}

class UsersController {
  async index(req, res) {
    try {
      const {
        name,
        email,
        createdBefore,
        createdAfter,
        updateBefore,
        updateAfter,
        sort,
      } = req.query;
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 25);
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger((page - 1) * limit)
      ) {
        throw AppError.fromResponse(400, {
          error:
            "page deve ser inteiro positivo e limit deve estar entre 1 e 100.",
        });
      }
      const where = {};
      for (const [field, value] of Object.entries({ name, email })) {
        if (value !== undefined) {
          if (typeof value !== "string") {
            throw AppError.fromResponse(400, {
              error: `${field} deve ser um texto.`,
            });
          }
          where[field] = { [Op.iLike]: `%${value}%` };
        }
      }
      for (const [field, operator, value] of [
        ["createdAt", Op.lte, createdBefore],
        ["createdAt", Op.gte, createdAfter],
        ["updatedAt", Op.lte, updateBefore],
        ["updatedAt", Op.gte, updateAfter],
      ]) {
        if (value !== undefined) {
          const date = typeof value === "string" ? parseISO(value) : null;
          if (!isValid(date)) {
            throw AppError.fromResponse(400, {
              error: "Informe datas ISO válidas.",
            });
          }
          where[field] = { ...where[field], [operator]: date };
        }
      }
      const order = [];
      if (sort !== undefined) {
        if (typeof sort !== "string") {
          throw AppError.fromResponse(400, {
            error: "sort deve ser um texto.",
          });
        }
        for (const item of sort.split(",")) {
          const [field, direction = "ASC", extra] = item.trim().split(":");
          if (
            !publicFields.includes(field) ||
            !["ASC", "DESC"].includes(direction.toUpperCase()) ||
            extra !== undefined
          ) {
            throw AppError.fromResponse(400, {
              error: "Ordenação inválida. Use name:ASC,createdAt:DESC.",
            });
          }
          order.push([field, direction.toUpperCase()]);
        }
      }
      if (!order.some(([field]) => field === "id")) order.push(["id", "ASC"]);
      const users = await User.findAll({
        attributes: publicFields,
        where,
        order,
        limit,
        offset: (page - 1) * limit,
      });

      User.findByPk(req.userId);
      return res.json(users.map(publicUser));
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async show(req, res) {
    try {
      if (!validId(req.params.id)) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }
      const user = await User.findByPk(Number(req.params.id), {
        attributes: publicFields,
      });
      if (!user)
        throw AppError.fromResponse(404, { error: "Usuário não encontrado." });
      return res.json(publicUser(user));
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async create(req, res) {
    try {
      try {
        const { password, name, email } = await userSchema(true).validate(
          req.body ?? {},
          { abortEarly: false, stripUnknown: true }
        );
        const user = await User.create({
          name,
          email,
          password_hash: await hashPassword(password),
        });
        try {
          await Queue.add(WelcomeMail.key, {
            name: user.name,
            email: user.email,
          });
        } catch (error) {
          monitoring.report(error, { component: "api", requestId: req.requestId, queue: WelcomeMail.key });
          return res.status(201).json({
            ...publicUser(user),
            warning:
              "Cadastro realizado, mas o email de boas-vindas ficou sem agendamento.",
          });
        }
        return res.status(201).json(publicUser(user));
      } catch (error) {
        throw normalizeError(error);
      }
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async update(req, res) {
    try {
      if (!validId(req.params.id)) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }
      if (req.userId !== Number(req.params.id)) {
        throw AppError.fromResponse(403, {
          error: "Você só pode alterar seu próprio usuário.",
        });
      }
      try {
        const { password, oldPassword, ...data } = await userSchema(
          false
        ).validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
        const user = await User.findByPk(Number(req.params.id));
        if (!user)
          throw AppError.fromResponse(404, {
            error: "Usuário não encontrado.",
          });
        if (password !== undefined) {
          if (!(await checkPassword(oldPassword, user.password_hash))) {
            throw AppError.fromResponse(401, {
              error: "Senha atual incorreta.",
            });
          }
          data.password_hash = await hashPassword(password);
        }
        await user.update(data);
        return res.json(publicUser(user));
      } catch (error) {
        throw normalizeError(error);
      }
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async destroy(req, res) {
    try {
      if (!validId(req.params.id)) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }
      if (req.userId !== Number(req.params.id)) {
        throw AppError.fromResponse(403, {
          error: "Você só pode excluir seu próprio usuário.",
        });
      }
      const user = await User.findByPk(Number(req.params.id));
      if (!user)
        throw AppError.fromResponse(404, { error: "Usuário não encontrado." });
      await user.destroy();
      return res.status(204).send();
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default new UsersController();
