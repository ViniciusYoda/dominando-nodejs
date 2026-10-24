import { normalizeError } from "../errors";
import { AppError } from "../errors";
import { isValid, parseISO } from "date-fns";
import { Op } from "sequelize";
import * as Yup from "yup";
import Contact from "../models/Contact";
import Customer from "../models/Customer";

class ContactsController {
  // Listagem de contatos
  async index(req, res) {
    try {
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
        throw AppError.fromResponse(400, {
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
          throw AppError.fromResponse(400, {
            error: "customer_id deve ser um inteiro positivo.",
          });
        }
        where.customer_id = customerId;
      }

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

      if (status !== undefined) {
        if (!["ACTIVE", "ARCHIVED"].includes(status)) {
          throw AppError.fromResponse(400, {
            error: "status deve ser ACTIVE ou ARCHIVED.",
          });
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
            throw AppError.fromResponse(400, {
              error: "Os filtros de data devem conter datas válidas.",
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
            ![
              "id",
              "name",
              "email",
              "status",
              "createdAt",
              "updatedAt",
            ].includes(field) ||
            !["ASC", "DESC"].includes(direction.toUpperCase()) ||
            extra !== undefined
          ) {
            throw AppError.fromResponse(400, {
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
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Recupera um contato
  async show(req, res) {
    try {
      const id = Number(req.params.id);

      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }

      const contact = await Contact.findByPk(id);

      if (!contact) {
        throw AppError.fromResponse(404, { error: "Contato não encontrado." });
      }

      return res.json(contact);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Cria um contato
  async create(req, res) {
    try {
      const text = () =>
        Yup.string().transform((value, originalValue) =>
          typeof originalValue === "string"
            ? originalValue.trim()
            : originalValue
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

      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (!(await Customer.findByPk(data.customer_id))) {
        throw AppError.fromResponse(404, { error: "Cliente não encontrado." });
      }
      const contact = await Contact.create({ status: "ACTIVE", ...data });

      return res.status(201).json(contact);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Atualiza um contato
  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }

      const text = () =>
        Yup.string().transform((value, originalValue) =>
          typeof originalValue === "string"
            ? originalValue.trim()
            : originalValue
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
        (data) =>
          data && Object.values(data).some((value) => value !== undefined)
      );

      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const contact = await Contact.findByPk(id);
      if (!contact) {
        throw AppError.fromResponse(404, { error: "Contato não encontrado." });
      }

      if (
        data.customer_id !== undefined &&
        !(await Customer.findByPk(data.customer_id))
      ) {
        throw AppError.fromResponse(404, { error: "Cliente não encontrado." });
      }
      await contact.update(data);
      return res.json(contact);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Exclui um contato
  async destroy(req, res) {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }

      const contact = await Contact.findByPk(id);
      if (!contact) {
        throw AppError.fromResponse(404, { error: "Contato não encontrado." });
      }

      await contact.destroy();
      return res.status(204).send();
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default new ContactsController();
