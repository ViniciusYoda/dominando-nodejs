import { randomUUID } from "node:crypto";
import logger from "../../lib/logger";

export default (req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const start = process.hrtime.bigint();
    res.once("finish", () => {
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        logger[level]("http_request", {
            component: "api", requestId: req.requestId, method: req.method,
            route: req.route?.path || "[unmatched]", statusCode: res.statusCode,
            durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        });
    });
    next();
};
