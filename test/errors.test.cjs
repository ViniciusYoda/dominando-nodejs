require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const Yup = require("yup");
const { UniqueConstraintError, ForeignKeyConstraintError, ConnectionError } = require("sequelize");
const { MulterError } = require("multer");
const { normalizeError, NotFoundError, UnauthorizedError, ForbiddenError } = require("../src/app/errors");
const errorHandler = require("../src/app/middlewares/errorHandler").default;

test("excecoes preservam causa e convertem erros externos em status HTTP", () => {
    const cases = [
        [new Yup.ValidationError("name obrigatorio"), 400, "VALIDATION_ERROR"],
        [new UniqueConstraintError({}), 409, "CONFLICT"],
        [new ForeignKeyConstraintError({}), 409, "CONFLICT"],
        [new ConnectionError(new Error("password=secret")), 503, "SERVICE_UNAVAILABLE"],
        [new MulterError("LIMIT_FILE_SIZE"), 400, "UPLOAD_ERROR"],
        [Object.assign(new Error("bad JSON"), { type: "entity.parse.failed" }), 400, "INVALID_REQUEST_BODY"],
        [Object.assign(new Error("large"), { type: "entity.too.large" }), 413, "INVALID_REQUEST_BODY"],
    ];
    for (const [cause, status, code] of cases) {
        const error = normalizeError(cause);
        assert.equal(error.statusCode, status);
        assert.equal(error.code, code);
        assert.equal(error.cause, cause);
        assert.equal(normalizeError(error), error);
    }
    for (const [exception, code] of [[new NotFoundError(), 404], [new UnauthorizedError(), 401], [new ForbiddenError(), 403]]) {
        assert.equal(normalizeError(exception).statusCode, code);
    }
});

test("middleware padroniza resposta sem expor stack, causa ou credenciais", (t) => {
    const log = console.error;
    console.error = () => {};
    t.after(() => { console.error = log; });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    errorHandler(new Error("password=secret"), {}, res, () => {});
    assert.equal(res.code, 500);
    assert.deepEqual(res.body, { error: "Erro interno do servidor.", code: "INTERNAL_ERROR" });
    assert.equal(JSON.stringify(res.body).includes("secret"), false);
    errorHandler(new Yup.ValidationError("name obrigatorio"), {}, res, () => {});
    assert.deepEqual(res.body.errors, ["name obrigatorio"]);
    const error = new Error("connection closed");
    let forwarded;
    errorHandler(error, {}, { headersSent: true }, (value) => { forwarded = value; });
    assert.equal(forwarded, error);
});
