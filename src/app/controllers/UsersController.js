import { isValid, parseISO } from "date-fns";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";
import * as Yup from "yup";
import User from "../models/User";
import { hashPassword, checkPassword } from "../lib/password";
import Mail from "../../lib/Mail";

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

function handleError(error, res) {
  if (error instanceof Yup.ValidationError) {
    return res
      .status(400)
      .json({ error: "Dados do usuário inválidos.", errors: error.errors });
  }
  if (error instanceof UniqueConstraintError) {
    return res
      .status(409)
      .json({ error: "Já existe um usuário com esse email." });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: "Dados do usuário inválidos." });
  }
  throw error;
}

class UsersController {
  async index(req, res) {
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
      return res.status(400).json({
        error:
          "page deve ser inteiro positivo e limit deve estar entre 1 e 100.",
      });
    }
    const where = {};
    for (const [field, value] of Object.entries({ name, email })) {
      if (value !== undefined) {
        if (typeof value !== "string") {
          return res.status(400).json({ error: `${field} deve ser um texto.` });
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
          return res.status(400).json({ error: "Informe datas ISO válidas." });
        }
        where[field] = { ...where[field], [operator]: date };
      }
    }
    const order = [];
    if (sort !== undefined) {
      if (typeof sort !== "string") {
        return res.status(400).json({ error: "sort deve ser um texto." });
      }
      for (const item of sort.split(",")) {
        const [field, direction = "ASC", extra] = item.trim().split(":");
        if (
          !publicFields.includes(field) ||
          !["ASC", "DESC"].includes(direction.toUpperCase()) ||
          extra !== undefined
        ) {
          return res.status(400).json({
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

    User.findByPk(req.userId)
    return res.json(users.map(publicUser));
  }

  async show(req, res) {
    if (!validId(req.params.id)) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }
    const user = await User.findByPk(Number(req.params.id), {
      attributes: publicFields,
    });
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado." });
    return res.json(publicUser(user));
  }

  async create(req, res) {
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
        await Mail.send({
          to: { name: user.name, address: user.email },
          subject: "Bem-vindo ao Dominando Node.js!",
          text: `Olá, ${user.name}!\n\nSeu cadastro foi realizado com sucesso.\n\nBem-vindo ao Dominando Node.js!`,
        });
      } catch {
        console.error("Não foi possível enviar o email de boas-vindas.");
        return res.status(201).json({
          ...publicUser(user),
          warning: "Cadastro realizado, mas não foi possível enviar o email de boas-vindas.",
        });
      }
      return res.status(201).json(publicUser(user));
    } catch (error) {
      return handleError(error, res);
    }
  }

  async update(req, res) {
    if (!validId(req.params.id)) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }
    if (req.userId !== Number(req.params.id)) {
      return res
        .status(403)
        .json({ error: "Você só pode alterar seu próprio usuário." });
    }
    try {
      const { password, oldPassword, ...data } = await userSchema(
        false
      ).validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
      const user = await User.findByPk(Number(req.params.id));
      if (!user)
        return res.status(404).json({ error: "Usuário não encontrado." });
      if (password !== undefined) {
        if (!(await checkPassword(oldPassword, user.password_hash))) {
          return res.status(401).json({ error: "Senha atual incorreta." });
        }
        data.password_hash = await hashPassword(password);
      }
      await user.update(data);
      return res.json(publicUser(user));
    } catch (error) {
      return handleError(error, res);
    }
  }

  async destroy(req, res) {
    if (!validId(req.params.id)) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }
    if (req.userId !== Number(req.params.id)) {
      return res
        .status(403)
        .json({ error: "Você só pode excluir seu próprio usuário." });
    }
    const user = await User.findByPk(Number(req.params.id));
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado." });
    await user.destroy();
    return res.status(204).send();
  }
}

export default new UsersController();
