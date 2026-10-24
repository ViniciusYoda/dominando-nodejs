import { integer, boolean } from "./env";

const port = integer("MAIL_PORT", 587, 1, 65535);

export default {
  host: process.env.MAIL_HOST,
  port,
  secure: boolean("MAIL_SECURE", port === 465),
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
