import { boolean } from "./env";
import appConfig from "./app";

const level = process.env.LOG_LEVEL || "info";
if (!["debug", "info", "warn", "error", "silent"].includes(level)) {
    throw new Error("LOG_LEVEL deve ser debug, info, warn, error ou silent.");
}

export default {
    level,
    environment: appConfig.environment,
    enabled: boolean("SENTRY_ENABLED", appConfig.environment === "production"),
    dsn: process.env.SENTRY_DSN || undefined,
    release: process.env.APP_RELEASE || undefined,
};
