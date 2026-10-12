import { isValid, parseISO } from "date-fns";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";
import * as Yup from "yup";
import Customer from "../models/Customer";

class CustomersController {
  // Listagem de clientes
  async index(req, res) {
    const {
      name,
      email,
      status,
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

    if (status !== undefined) {
      if (!["ACTIVE", "ARCHIVED"].includes(status)) {
        return res
          .status(400)
          .json({ error: "status deve ser ACTIVE ou ARCHIVED." });
      }
      where.status = status;
    }

    const dates = [
      ["createdAt", Op.lte, createdBefore],
      ["createdAt", Op.gte, createdAfter],
      ["updatedAt", Op.lte, updateBefore],
      ["updatedAt", Op.gte, updateAfter],
    ];

    for (const [field, operator, value] of dates) {
      if (value !== undefined) {
        const date = typeof value === "string" ? parseISO(value) : null;
        if (!isValid(date)) {
          return res
            .status(400)
            .json({ error: "Os filtros de data devem conter datas válidas." });
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
          !["id", "name", "email", "status", "createdAt", "updatedAt"].includes(
            field
          ) ||
          !["ASC", "DESC"].includes(direction.toUpperCase()) ||
          extra !== undefined
        ) {
          return res.status(400).json({
            error:
              "Ordenação inválida. Use, por exemplo, name:ASC,createdAt:DESC.",
          });
        }
        order.push([field, direction.toUpperCase()]);
      }
    }
    if (!order.some(([field]) => field === "id")) {
      order.push(["id", "ASC"]);
    }

    const data = await Customer.findAll({
      where,
      order,
      limit,
      offset: (page - 1) * limit,
    });
    return res.json(data);
  }

  // Recupera um cliente
  async show(req, res) {
    const id = Number(req.params.id);

    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }

    const customer = await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    return res.json(customer);
  }

  // Cria um cliente
  async create(req, res) {
    const text = () =>
      Yup.string().transform((value, originalValue) =>
        typeof originalValue === "string" ? originalValue.trim() : originalValue
      );
    const schema = Yup.object({
      name: text()
        .typeError("name deve ser um texto.")
        .required("name é obrigatório.")
        .max(255, "name deve ter no máximo 255 caracteres."),
      email: text()
        .typeError("email deve ser um texto.")
        .required("email é obrigatório.")
        .email("Informe um email válido.")
        .max(255, "email deve ter no máximo 255 caracteres."),
      status: Yup.string()
        .strict()
        .oneOf(["ACTIVE", "ARCHIVED"], "status deve ser ACTIVE ou ARCHIVED."),
    });

    try {
      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const customer = await Customer.create(data);

      return res.status(201).json(customer);
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        return res
          .status(400)
          .json({ error: "Dados do cliente inválidos.", errors: error.errors });
      }
      if (error instanceof UniqueConstraintError) {
        return res
          .status(409)
          .json({ error: "Já existe um cliente com esse email." });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: "Dados do cliente inválidos." });
      }
      throw error;
    }
  }

  // Atualiza um cliente
  async update(req, res) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }

    const text = () =>
      Yup.string().transform((value, originalValue) =>
        typeof originalValue === "string" ? originalValue.trim() : originalValue
      );
    const schema = Yup.object({
      name: text()
        .typeError("name deve ser um texto.")
        .min(1, "name não pode ser vazio.")
        .max(255, "name deve ter no máximo 255 caracteres."),
      email: text()
        .typeError("email deve ser um texto.")
        .min(1, "email não pode ser vazio.")
        .email("Informe um email válido.")
        .max(255, "email deve ter no máximo 255 caracteres."),
      status: Yup.string()
        .strict()
        .oneOf(["ACTIVE", "ARCHIVED"], "status deve ser ACTIVE ou ARCHIVED."),
    }).test(
      "has-fields",
      "Informe ao menos um campo: name, email ou status.",
      (data) => data && Object.values(data).some((value) => value !== undefined)
    );

    try {
      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const customer = await Customer.findByPk(id);
      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      await customer.update(data);
      return res.json(customer);
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        return res
          .status(400)
          .json({ error: "Dados do cliente inválidos.", errors: error.errors });
      }
      if (error instanceof UniqueConstraintError) {
        return res
          .status(409)
          .json({ error: "Já existe um cliente com esse email." });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: "Dados do cliente inválidos." });
      }
      throw error;
    }
  }

  // Exclui um cliente
  async destroy(req, res) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    await customer.destroy();
    return res.status(204).send();
  }
}

export default new CustomersController();
