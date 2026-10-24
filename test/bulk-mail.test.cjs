require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const Queue = require("../src/app/lib/Queue").default;
const { Queue: QueueClass } = require("../src/app/lib/Queue");
const controller = require("../src/app/controllers/BulkEmailsController").default;
const BulkMail = require("../src/app/jobs/BulkMail").default;
const Mail = require("../src/lib/Mail").default;

test("lotes validam antes de agendar, deduplicam e informam falhas parciais", async (t) => {
    const original = Queue.addMany;
    t.after(() => { Queue.addMany = original; });
    let items, calls = 0;
    Queue.addMany = async (key, data) => {
        calls++;
        assert.equal(key, "BulkMail");
        items = data;
        return data.map((item, index) => ({ status: "fulfilled", value: { id: String(index) } }));
    };
    async function request(body) {
        const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        try {
            await controller.create({ body }, res);
        } catch (error) {
            require("../src/app/middlewares/errorHandler").default(error, {}, res, () => {});
        }
        return res;
    }
    const body = { subject: "Atualizacao", text: "Ola!", recipients: [{ name: "Ana", email: "ana@example.com" }, { email: "ANA@example.com" }, { email: "bruno@example.com" }] };
    for (const invalid of [undefined, {}, { ...body, recipients: [] }, { ...body, subject: "" }, { ...body, recipients: [{ email: "bad" }] }, { ...body, recipients: Array(1001).fill({ email: "ana@example.com" }) }]) {
        assert.equal((await request(invalid)).code, 400);
    }
    assert.equal(calls, 0);
    const accepted = await request(body);
    assert.equal(accepted.code, 202);
    assert.equal(accepted.body.queuedCount, 2);
    assert.equal(accepted.body.duplicates, 1);
    assert.equal(items.length, 2);
    assert.equal(items[0].subject, body.subject);
    Queue.addMany = async () => [{ status: "fulfilled", value: { id: "1" } }, { status: "rejected", reason: new Error("Redis") }];
    const partial = await request(body);
    assert.equal(partial.code, 207);
    assert.equal(partial.body.failedCount, 1);
    assert.deepEqual(partial.body.failed, ["bruno@example.com"]);
    Queue.addMany = async (key, data) => data.map(() => ({ status: "rejected", reason: new Error("Redis") }));
    assert.equal((await request(body)).code, 503);
});

test("job envia individualmente e propaga erros para retry", async (t) => {
    const original = Mail.send;
    t.after(() => { Mail.send = original; });
    let message;
    Mail.send = async (data) => { message = data; };
    await BulkMail.handle({ data: { recipient: { name: "Ana", email: "ana@example.com" }, subject: "Teste", text: "Ola", html: "<p>Ola</p>" } });
    assert.deepEqual(message.to, { name: "Ana", address: "ana@example.com" });
    assert.equal(message.bcc, undefined);
    assert.equal(message.html, "<p>Ola</p>");
    Mail.send = async () => { throw new Error("SMTP"); };
    await assert.rejects(BulkMail.handle({ data: { recipient: { email: "ana@example.com" } } }), /SMTP/);
});

test("agendamento limita concorrencia e preserva resultados por destinatario", async () => {
    const queue = new QueueClass();
    queue.getQueue = () => ({});
    let active = 0, maximum = 0;
    queue.add = async (key, item) => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((done) => setImmediate(done));
        active--;
        if (item === 30) throw new Error("Redis");
        return { id: String(item) };
    };
    const results = await queue.addMany("BulkMail", Array.from({ length: 60 }, (item, index) => index));
    assert.equal(maximum, 25);
    assert.equal(results.length, 60);
    assert.equal(results[30].status, "rejected");
    assert.equal(results[59].value.id, "59");
});
