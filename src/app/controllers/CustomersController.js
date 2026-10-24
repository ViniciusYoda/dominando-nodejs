import { normalizeError } from "../errors";
import { AppError } from "../errors";
import { isValid, parseISO } from "date-fns";
import { Op } from "sequelize";
import * as Yup from "yup";
import Customer from "../models/Customer";

class CustomersController {
  // Listagem de clientes
  async index(req, res) {
    try {
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

      const data = await Customer.findAll({
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

  // Recupera um cliente
  async show(req, res) {
    try {
      const id = Number(req.params.id);

      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }

      const customer = await Customer.findByPk(id);

      if (!customer) {
        throw AppError.fromResponse(404, { error: "Cliente não encontrado." });
      }

      return res.json(customer);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Cria um cliente
  async create(req, res) {
    try {
      const text = () =>
        Yup.string().transform((value, originalValue) =>
          typeof originalValue === "string"
            ? originalValue.trim()
            : originalValue
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

      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const customer = await Customer.create(data);

      return res.status(201).json(customer);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Atualiza um cliente
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
        (data) =>
          data && Object.values(data).some((value) => value !== undefined)
      );

      const data = await schema.validate(req.body ?? {}, {
        abortEarly: false,
        stripUnknown: true,
      });
      const customer = await Customer.findByPk(id);
      if (!customer) {
        throw AppError.fromResponse(404, { error: "Cliente não encontrado." });
      }

      await customer.update(data);
      return res.json(customer);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  // Exclui um cliente
  async destroy(req, res) {
    try {
      const id = Number(req.params.id);
      if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
        throw AppError.fromResponse(400, {
          error: "id deve ser um inteiro positivo.",
        });
      }

      const customer = await Customer.findByPk(id);
      if (!customer) {
        throw AppError.fromResponse(404, { error: "Cliente não encontrado." });
      }

      await customer.destroy();
      return res.status(204).send();
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default new CustomersController();
