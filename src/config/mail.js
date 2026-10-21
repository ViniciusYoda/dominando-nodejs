import "dotenv/config";

const port = Number(process.env.MAIL_PORT || 587);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("MAIL_PORT deve ser um inteiro entre 1 e 65535.");
}

export default {
  host: process.env.MAIL_HOST,
  port,
  secure: process.env.MAIL_SECURE === undefined
    ? port === 465
    : process.env.MAIL_SECURE === "true",
  auth: process.env.MAIL_USER || process.env.MAIL_PASS
    ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    : undefined,
  defaults: {
    from: {
      name: process.env.MAIL_FROM_NAME || "Dominando Node.js",
      address: process.env.MAIL_FROM_EMAIL,
    },
  },
};
