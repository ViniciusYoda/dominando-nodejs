import config from "../config/monitoring";

const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: Infinity };
const fields = ["component", "requestId", "method", "route", "statusCode", "durationMs", "code", "errorType", "queue", "jobId", "eventId", "port"];

export function safeMetadata(metadata = {}) {
    return Object.fromEntries(fields.filter((key) => {
        const value = metadata[key];
        return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
    }).map((key) => [key, typeof metadata[key] === "string" ? metadata[key].slice(0, 200) : metadata[key]]));
}

export function createLogger({ level = config.level, write = (line) => process.stdout.write(line) } = {}) {
    const logger = {};
    for (const name of ["debug", "info", "warn", "error"]) {
        logger[name] = (event, metadata = {}) => {
            if (levels[name] < levels[level]) return;
            try {
                write(JSON.stringify({
                    timestamp: new Date().toISOString(), level: name,
                    event, environment: config.environment, ...safeMetadata(metadata),
                }) + "\n");
            } catch {
                // Uma falha de logging nao pode derrubar a API ou impedir retry.
            }
        };
    }
    return logger;
}

export default createLogger();
