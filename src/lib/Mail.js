import nodemailer from "nodemailer";
import mailConfig from "../config/mail";

class Mail {
    constructor() {
        const { defaults, ...transport } = mailConfig;
        this.transporter = nodemailer.createTransport(transport, defaults);
    }

    async send(message) {
        if (!mailConfig.host || !mailConfig.defaults.from.address) {
            throw new Error("Configure MAIL_HOST e MAIL_FROM_EMAIL no .env.");
        }
        if (mailConfig.auth && (!mailConfig.auth.user || !mailConfig.auth.pass)) {
            throw new Error("Configure MAIL_USER e MAIL_PASS juntos no .env.");
        }
        if (!message || (!message.to && !message.cc && !message.bcc)) {
            throw new Error("Informe um destinatário no email.");
        }
        return this.transporter.sendMail(message);
    }
}

export default new Mail();
