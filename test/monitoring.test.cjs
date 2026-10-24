require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createLogger } = require("../src/lib/logger");
const { createMonitoring, sanitizeEvent } = require("../src/lib/monitoring");
const { BadRequestError, ServiceUnavailableError } = require("../src/app/errors");

test("logs JSON filtram campos sensiveis e respeitam LOG_LEVEL", () => {
    const lines = [];
    const log = createLogger({ level: "warn", write: (line) => lines.push(line) });
    log.info("ignored");
    log.error("test_error", { component: "api", requestId: "test-id", password: "secret", token: "secret", email: "private@example.com", body: { password: "secret" }, headers: { authorization: "Bearer secret" } });
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.requestId, "test-id");
    assert.equal(entry.level, "error");
    assert.equal(lines[0].includes("secret"), false);
    assert.equal(lines[0].includes("private@example.com"), false);
    const broken = createLogger({ write: () => { throw new Error("stdout unavailable"); } });
    assert.doesNotThrow(() => broken.error("test_error"));
});

test("Sentry recebe erros sanitizados, ignora 4xx e nao duplica o mesmo erro", async () => {
    let options, captured, captureCount = 0, flushed = false;
    const sdk = {
        init(value) { options = value; },
        captureException(error, context) { captured = { error, context }; captureCount++; return "event-1"; },
        async flush() { flushed = true; return true; },
    };
    const lines = [];
    const log = createLogger({ level: "info", write: (line) => lines.push(line) });
    const monitor = createMonitoring({ sdk, log, options: { enabled: true, dsn: "https://public@example.com/1", environment: "production" } });
    assert.equal(options.defaultIntegrations, false);
    assert.deepEqual(options.dataCollection.httpBodies, []);
    monitor.report(new BadRequestError());
    assert.equal(captureCount, 0);
    const error = new ServiceUnavailableError("safe", { cause: new Error("password=secret private@example.com") });
    assert.equal(monitor.report(error, { component: "api", requestId: "test-id", body: { password: "secret" } }), "event-1");
    monitor.report(error);
    assert.equal(captureCount, 1);
    assert.equal(captured.error.message, "SERVICE_UNAVAILABLE");
    assert.equal(captured.error.stack.includes("password=secret"), false);
    assert.equal(captured.context.tags.requestId, "test-id");
    assert.equal(captured.context.tags.body, undefined);
    assert.equal(JSON.parse(lines[0]).eventId, "event-1");
    await monitor.flush();
    assert.equal(flushed, true);
});

test("beforeSend remove request, breadcrumbs, variaveis e linhas de codigo", () => {
    const cleaned = sanitizeEvent({ event_id: "id", request: { headers: { authorization: "secret" }, data: { password: "secret" } }, user: { email: "secret" }, extra: { data: "secret" }, breadcrumbs: [{ message: "secret" }], tags: { queue: "BulkMail", password: "secret" }, exception: { values: [{ value: "secret", stacktrace: { frames: [{ filename: "app.js", function: "send", lineno: 10, context_line: "secret", vars: { password: "secret" } }] } }] } });
    assert.equal(JSON.stringify(cleaned).includes("secret"), false);
    assert.equal(cleaned.tags.queue, "BulkMail");
    assert.equal(cleaned.exception.values[0].stacktrace.frames[0].lineno, 10);
});

test("monitoramento desabilitado e falha no Sentry nao impedem a aplicacao", async () => {
    const log = createLogger({ write: () => {} });
    const disabled = createMonitoring({ sdk: { init() { throw new Error("should not init"); } }, log, options: { enabled: false } });
    assert.doesNotThrow(() => disabled.report(new Error("error")));
    const broken = createMonitoring({ sdk: { init() {}, captureException() { throw new Error("capture failed"); }, flush() { throw new Error("flush failed"); } }, log, options: { enabled: true, dsn: "dsn" } });
    assert.doesNotThrow(() => broken.report(new Error("error")));
    assert.equal(await broken.flush(), false);
});

test("requestId correlaciona resposta e log sem registrar query ou corpo", () => {
    const logger = require("../src/lib/logger").default;
    const previous = logger.info;
    let metadata;
    logger.info = (event, value) => { metadata = value; };
    try {
        const requestLogger = require("../src/app/middlewares/requestLogger").default;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.setHeader = (key, value) => { res[key] = value; };
        const req = { method: "GET", route: { path: "/users/:id" }, url: "/users/1?token=secret", body: { password: "secret" } };
        requestLogger(req, res, () => {});
        res.emit("finish");
        assert.equal(metadata.requestId, res["X-Request-Id"]);
        assert.equal(metadata.route, "/users/:id");
        assert.equal(JSON.stringify(metadata).includes("secret"), false);
    } finally { logger.info = previous; }
});

test("SDK real do Sentry serializa evento com transporte em memoria sem rede", async () => {
    const Sentry = require("@sentry/node");
    const envelopes = [];
    const sdk = {
        init(options) {
            Sentry.init({ ...options, transport: () => ({
                async send(envelope) { envelopes.push(envelope); return { statusCode: 200 }; },
                async flush() { return true; },
            }) });
        },
        captureException: Sentry.captureException,
        flush: Sentry.flush,
    };
    try {
        const monitor = createMonitoring({ sdk, log: createLogger({ write: () => {} }), options: { enabled: true, dsn: "https://public@example.com/1", environment: "test" } });
        monitor.report(new Error("password=secret"), { component: "worker", queue: "BulkMail" });
        await monitor.flush();
        assert.equal(envelopes.length, 1);
        const serialized = JSON.stringify(envelopes);
        assert.equal(serialized.includes("password=secret"), false);
        assert.ok(serialized.includes("BulkMail"));
    } finally { await Sentry.close(1000); }
});

test("erro fatal encerra processo com codigo 1 e log sem segredo", () => {
    const { spawnSync } = require("node:child_process");
    const result = spawnSync(process.execPath, ["-r", "sucrase/register", "-e", "require('./src/instrument'); throw new Error('password=secret');"], {
        cwd: require("node:path").resolve(__dirname, ".."),
        env: { ...process.env, SENTRY_ENABLED: "false", LOG_LEVEL: "info" },
        encoding: "utf8", timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.ok(result.stdout.includes('"event":"process_fatal"'));
    assert.equal((result.stdout + result.stderr).includes("password=secret"), false);
});
