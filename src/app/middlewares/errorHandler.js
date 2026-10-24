import { normalizeError } from "../errors";
import monitoring from "../../lib/monitoring";

export default (error, req, res, next) => {
  const exception = normalizeError(error);
  if (exception.statusCode >= 500) {
    monitoring.report(exception, { component: "api", requestId: req.requestId, method: req.method, route: req.route?.path || "[unmatched]", statusCode: exception.statusCode });
  }
  if (res.headersSent) return next(error);
  return res.status(exception.statusCode).json({
    error: exception.message,
    code: exception.code,
    ...(exception.details ? { errors: exception.details } : {}),
  });
};
