import * as Yup from "yup";
import {
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
  ForeignKeyConstraintError,
  ConnectionError,
} from "sequelize";
import { MulterError } from "multer";

export class AppError extends Error {
  constructor(
    message,
    { statusCode = 500, code = "INTERNAL_ERROR", details, cause } = {}
  ) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static fromResponse(status, payload) {
    const ErrorClass = {
      400: BadRequestError,
      401: UnauthorizedError,
      403: ForbiddenError,
      404: NotFoundError,
      409: ConflictError,
      503: ServiceUnavailableError,
    }[status];
    return ErrorClass
      ? new ErrorClass(payload.error, { details: payload.errors })
      : new AppError(payload.error, {
          statusCode: status,
          details: payload.errors,
        });
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Dados invalidos.", options = {}) {
    super(message, {
      ...options,
      statusCode: 400,
      code: options.code || "VALIDATION_ERROR",
    });
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Autenticacao necessaria.", options = {}) {
    super(message, { ...options, statusCode: 401, code: "UNAUTHORIZED" });
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.", options = {}) {
    super(message, { ...options, statusCode: 403, code: "FORBIDDEN" });
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado.", options = {}) {
    super(message, { ...options, statusCode: 404, code: "NOT_FOUND" });
  }
}
export class ConflictError extends AppError {
  constructor(message = "Registro em conflito.", options = {}) {
    super(message, { ...options, statusCode: 409, code: "CONFLICT" });
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(message = "Servico temporariamente indisponivel.", options = {}) {
    super(message, {
      ...options,
      statusCode: 503,
      code: options.code || "SERVICE_UNAVAILABLE",
    });
  }
}

export function normalizeError(error) {
  if (error instanceof AppError) return error;
  if (error instanceof Yup.ValidationError) {
    return new BadRequestError("Dados invalidos.", {
      details: error.errors,
      cause: error,
    });
  }
  if (error instanceof UniqueConstraintError) {
    return new ConflictError("Ja existe um registro com esses dados.", {
      cause: error,
    });
  }
  if (error instanceof ForeignKeyConstraintError) {
    return new ConflictError("Registro relacionado inexistente ou em uso.", {
      cause: error,
    });
  }
  if (error instanceof SequelizeValidationError) {
    return new BadRequestError("Dados invalidos para gravacao.", {
      cause: error,
    });
  }
  if (error instanceof ConnectionError) {
    return new ServiceUnavailableError("Banco de dados indisponivel.", {
      cause: error,
    });
  }
  if (error instanceof MulterError) {
    return new BadRequestError("Upload invalido.", {
      code: "UPLOAD_ERROR",
      cause: error,
    });
  }
  if (
    error &&
    ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
      error.name
    )
  ) {
    return new UnauthorizedError("Token invalido ou expirado.", {
      cause: error,
    });
  }
  if (
    error &&
    ["entity.parse.failed", "entity.too.large"].includes(error.type)
  ) {
    return new AppError(
      error.type === "entity.too.large"
        ? "Corpo da requisicao excede o limite."
        : "JSON invalido.",
      {
        statusCode: error.type === "entity.too.large" ? 413 : 400,
        code: "INVALID_REQUEST_BODY",
        cause: error,
      }
    );
  }
  return new AppError("Erro interno do servidor.", { cause: error });
}
