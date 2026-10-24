require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Queue } = require("../src/app/lib/Queue");
const WelcomeMail = require("../src/app/jobs/WelcomeMail").default;
const Mail = require("../src/lib/Mail").default;

class FakeBee extends EventEmitter {
  constructor(key, settings) { super(); this.key = key; this.settings = settings; }
  async ready() { if (this.unavailable) throw new Error("Redis unavailable"); }
  createJob(data) {
    const job = { data, retries(value) { this.retryCount = value; return this; }, backoff(strategy, delay) { this.retryBackoff = { strategy, delay }; return this; }, async save() { return this; } };
    return job;
  }
  process(concurrency, handle) { this.concurrency = concurrency; this.handle = handle; }
  checkStalledJobs(interval) { this.stalledInterval = interval; }
  async close() { this.closed = true; }
}

test("produtor registra jobs com retry sem iniciar processamento", async () => {
  const queue = new Queue({ QueueClass: FakeBee });
  assert.deepEqual(queue.queues, {});
  const job = await queue.add(WelcomeMail.key, { name: "Ana", email: "ana@example.com" });
  assert.equal(job.retryCount, 3);
  assert.deepEqual(job.retryBackoff, { strategy: "exponential", delay: 1000 });
  const { bee } = queue.queues.WelcomeMail;
  assert.equal(bee.settings.isWorker, false);
  assert.equal(bee.handle, undefined);
  assert.equal(bee.settings.removeOnSuccess, true);
  assert.equal(bee.settings.removeOnFailure, false);
  bee.unavailable = true;
  await assert.rejects(queue.add(WelcomeMail.key, {}), (error) => error.code === "QUEUE_UNAVAILABLE" && error.cause.message === "Redis unavailable");
  await assert.rejects(queue.add("Unknown", {}), /desconhecido/);
  await queue.close();
  assert.equal(bee.closed, true);
});

test("worker processa jobs e propaga falhas SMTP para permitir retry", async (t) => {
  const originalSend = Mail.send;
  t.after(() => { Mail.send = originalSend; });
  let message;
  Mail.send = async (data) => { message = data; return { messageId: "test" }; };
  const queue = new Queue({ worker: true, QueueClass: FakeBee });
  await queue.processQueue();
  const { bee } = queue.queues.WelcomeMail;
  assert.equal(bee.settings.activateDelayedJobs, true);
  assert.equal(bee.settings.isWorker, true);
  assert.equal(bee.stalledInterval, 5000);
  await bee.handle({ data: { name: "Ana", email: "ana@example.com" } });
  assert.equal(message.to.address, "ana@example.com");
  assert.ok(message.text.includes("Ana"));
  Mail.send = async () => { throw new Error("SMTP unavailable"); };
  await assert.rejects(bee.handle({ data: { name: "Ana", email: "ana@example.com" } }), /SMTP unavailable/);
  await queue.close();
  assert.equal(bee.closed, true);
});

test("falha definitiva do worker e enviada ao monitoramento sem payload", async (t) => {
  const monitoring = require("../src/lib/monitoring").default;
  const previous = monitoring.report;
  const captured = [];
  monitoring.report = (error, context) => captured.push({ error, context });
  t.after(() => { monitoring.report = previous; });
  const queue = new Queue({ worker: true, QueueClass: FakeBee });
  await queue.processQueue();
  const { bee } = queue.queues.WelcomeMail;
  const failure = new Error("SMTP secret");
  bee.emit("failed:fatal", { id: "123", data: { email: "private@example.com" } }, failure);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].error, failure);
  assert.deepEqual(captured[0].context, { component: "worker", queue: "WelcomeMail", jobId: "123" });
  await queue.close();
});
