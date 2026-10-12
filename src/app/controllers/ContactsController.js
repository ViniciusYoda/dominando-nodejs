import { isValid, parseISO } from "date-fns";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";
import * as Yup from "yup";
import Contact from "../models/Contact";
import Customer from "../models/Customer";

class ContactsController {
  // Listagem de contatos
  async index(req, res) {
    const {
      name,
      email,
      status,
      customer_id,
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

    if (customer_id !== undefined) {
      const customerId = Number(customer_id);
      if (
        typeof customer_id !== "string" ||
        !/^\d+$/.test(customer_id) ||
        !Number.isSafeInteger(customerId) ||
        customerId < 1
      ) {
        return res
          .status(400)
          .json({ error: "customer_id deve ser um inteiro positivo." });
      }
      where.customer_id = customerId;
    }

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

    const data = await Contact.findAll({
      where,
      order,
      limit,
      offset: (page - 1) * limit,
    });
    return res.json(data);
  }

  // Recupera um contato
  async show(req, res) {
    const id = Number(req.params.id);

    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }

    const contact = await Contact.findByPk(id);

    if (!contact) {
      return res.status(404).json({ error: "Contato não encontrado." });
    }

    return res.json(contact);
  }

  // Cria um contato
  async create(req, res) {
    const text = () =>
      Yup.string().transform((value, originalValue) =>
        typeof originalValue === "string" ? originalValue.trim() : originalValue
      );
    const schema = Yup.object({
      customer_id: Yup.number()
        .strict()
        .typeError("customer_id deve ser um número.")
        .integer()
        .positive()
        .max(Number.MAX_SAFE_INTEGER)
        .required("customer_id é obrigatório."),
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
      if (!(await Customer.findByPk(data.customer_id))) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
      const contact = await Contact.create({ status: "ACTIVE", ...data });

      return res.status(201).json(contact);
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        return res
          .status(400)
          .json({ error: "Dados do contato inválidos.", errors: error.errors });
      }
      if (error instanceof UniqueConstraintError) {
        return res
          .status(409)
          .json({ error: "Já existe um contato com esse email." });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: "Dados do contato inválidos." });
      }
      throw error;
    }
  }

  // Atualiza um contato
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
      customer_id: Yup.number()
        .strict()
        .typeError("customer_id deve ser um número.")
        .integer()
        .positive()
        .max(Number.MAX_SAFE_INTEGER),
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
      "Informe ao menos um campo: name, email, status ou customer_id.",
      (data) => data && Object.values(data).some((value) => value !== undefined)
    );

    try {
      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const contact = await Contact.findByPk(id);
      if (!contact) {
        return res.status(404).json({ error: "Contato não encontrado." });
      }

      if (
        data.customer_id !== undefined &&
        !(await Customer.findByPk(data.customer_id))
      ) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }
      await contact.update(data);
      return res.json(contact);
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        return res
          .status(400)
          .json({ error: "Dados do contato inválidos.", errors: error.errors });
      }
      if (error instanceof UniqueConstraintError) {
        return res
          .status(409)
          .json({ error: "Já existe um contato com esse email." });
      }
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: "Dados do contato inválidos." });
      }
      throw error;
    }
  }

  // Exclui um contato
  async destroy(req, res) {
    const id = Number(req.params.id);
    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "id deve ser um inteiro positivo." });
    }

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ error: "Contato não encontrado." });
    }

    await contact.destroy();
    return res.status(204).send();
  }
}

export default new ContactsController();
