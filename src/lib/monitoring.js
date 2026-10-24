import * as Sentry from "@sentry/node";
import config from "../config/monitoring";
import logger, { safeMetadata } from "./logger";
import { normalizeError } from "../app/errors";

export function sanitizeEvent(event) {
    return {
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: "node",
        environment: config.environment,
        release: config.release,
        level: "error",
        tags: safeMetadata(event.tags),
        exception: { values: (event.exception?.values || []).map((exception) => ({
            type: "ApplicationError",
            value: "Application failure. See error code and stack frames.",
            stacktrace: { frames: (exception.stacktrace?.frames || []).map((frame) => ({
                filename: typeof frame.filename === "string" ? frame.filename.replace(process.cwd(), "<project>").split("?")[0] : undefined,
                function: frame.function,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
            })) },
        })) },
    };
}

export function createMonitoring({ sdk = Sentry, log = logger, options = config } = {}) {
    const enabled = Boolean(options.enabled && options.dsn);
    const seen = new WeakSet();
    let ready = false;
    if (enabled) {
        try {
            sdk.init({
                dsn: options.dsn, environment: options.environment, release: options.release,
                defaultIntegrations: false,
                dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false, frameContextLines: 0 },
                beforeSend: sanitizeEvent,
                tracesSampleRate: 0,
            });
            ready = true;
        } catch {
            log.warn("sentry_initialization_failed");
        }
    }

    return {
        report(error, metadata = {}) {
            const exception = normalizeError(error);
            if (exception.statusCode < 500) return;
            if (error && typeof error === "object") {
                if (seen.has(error)) return;
                seen.add(error);
            }
            const context = { ...safeMetadata(metadata), code: exception.code, errorType: exception.name };
            let eventId;
            if (ready) {
                try {
                    const original = exception.cause instanceof Error ? exception.cause : exception;
                    const safeError = new Error(exception.code);
                    if (original.stack) {
                        safeError.stack = `Error: ${exception.code}\n` + original.stack.split("\n").slice(1)
                            .filter((line) => /^\s+at /.test(line)).join("\n");
                    }
                    eventId = sdk.captureException(safeError, { tags: context });
                } catch {
                    log.warn("sentry_capture_failed");
                }
            }
            log.error("application_error", { ...context, eventId });
            return eventId;
        },
        async flush() {
            if (!ready) return true;
            try { return await sdk.flush(2000); }
            catch { log.warn("sentry_flush_failed"); return false; }
        },
    };
}

export default createMonitoring();
