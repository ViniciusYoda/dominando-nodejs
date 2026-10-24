import nodemailer from "nodemailer";
import mailConfig from "../config/mail";
import { BadRequestError, ServiceUnavailableError } from "../app/errors";

class Mail {
  constructor() {
    const { defaults, ...transport } = mailConfig;
    this.transporter = nodemailer.createTransport(transport, defaults);
  }

  async send(message) {
    if (!mailConfig.host || !mailConfig.defaults.from.address) {
      throw new ServiceUnavailableError(
        "Configure MAIL_HOST e MAIL_FROM_EMAIL no .env.",
        { code: "MAIL_NOT_CONFIGURED" }
      );
    }
    if (mailConfig.auth && (!mailConfig.auth.user || !mailConfig.auth.pass)) {
      throw new ServiceUnavailableError(
        "Configure MAIL_USER e MAIL_PASS juntos no .env.",
        { code: "MAIL_NOT_CONFIGURED" }
      );
    }
    if (!message || (!message.to && !message.cc && !message.bcc)) {
      throw new BadRequestError("Informe um destinatário no email.");
    }
    try {
      return await this.transporter.sendMail(message);
    } catch (cause) {
      throw new ServiceUnavailableError("Falha no envio do email.", {
        code: "MAIL_DELIVERY_FAILED",
        cause,
      });
    }
  }
}

export default new Mail();
