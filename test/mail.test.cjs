require("sucrase/register");
const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");

test("Mail configura SMTP e encaminha mensagens sem envio real", async (t) => {
  const keys = ["MAIL_HOST", "MAIL_PORT", "MAIL_SECURE", "MAIL_USER", "MAIL_PASS", "MAIL_FROM_NAME", "MAIL_FROM_EMAIL"];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalCreateTransport = nodemailer.createTransport;
  t.after(() => {
    nodemailer.createTransport = originalCreateTransport;
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  Object.assign(process.env, {
    MAIL_HOST: "smtp.example.com", MAIL_PORT: "587", MAIL_SECURE: "false",
    MAIL_USER: "test-user", MAIL_PASS: "test-password",
    MAIL_FROM_NAME: "Teste", MAIL_FROM_EMAIL: "sender@example.com",
  });
  let transport, defaults, received, failure;
  nodemailer.createTransport = (options, values) => {
    transport = options;
    defaults = values;
    return { async sendMail(message) {
      if (failure) throw failure;
      received = message;
      return { messageId: "test-id" };
    } };
  };
  const mail = require("../src/lib/Mail").default;
  const config = require("../src/config/mail").default;
  assert.equal(transport.host, "smtp.example.com");
  assert.equal(transport.port, 587);
  assert.equal(transport.secure, false);
  assert.deepEqual(transport.auth, { user: "test-user", pass: "test-password" });
  assert.equal(defaults.from.address, "sender@example.com");
  const message = { to: "recipient@example.com", subject: "Teste", text: "Mensagem" };
  assert.deepEqual(await mail.send(message), { messageId: "test-id" });
  assert.equal(received, message);
  await assert.rejects(mail.send({ subject: "Sem destinatário" }), /destinatário/);
  failure = new Error("SMTP unavailable");
  await assert.rejects(mail.send(message), (error) => error.code === "MAIL_DELIVERY_FAILED" && error.cause === failure);
  config.host = undefined;
  await assert.rejects(mail.send(message), /MAIL_HOST/);
});
