import Mail from "../../lib/Mail";
import queueConfig from "../../config/queue";


class BulkMail {
    get key() { return "BulkMail"; }
    get concurrency() { return queueConfig.bulkConcurrency; }

    async handle({ data }) {
        const { recipient, subject, text, html } = data;
        await Mail.send({
            to: { name: recipient.name || "", address: recipient.email },
            subject,
            text,
            ...(html ? { html } : {}),
        });
    }
}

export default new BulkMail();
