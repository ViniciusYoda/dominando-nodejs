import { normalizeError } from "../errors";
import { AppError } from "../errors";
import * as Yup from "yup";
import Queue from "../lib/Queue";
import BulkMail from "../jobs/BulkMail";
import monitoring from "../../lib/monitoring";

const schema = Yup.object({
  recipients: Yup.array()
    .of(
      Yup.object({
        name: Yup.string().strict().max(255),
        email: Yup.string().strict().email().max(255).required(),
      }).required()
    )
    .min(1)
    .max(1000)
    .required(),
  subject: Yup.string().strict().trim().min(1).max(255).required(),
  text: Yup.string().strict().trim().min(1).max(20000).required(),
  html: Yup.string().strict().max(50000),
}).required();

class BulkEmailsController {
  async create(req, res) {
    try {
      let data;
      try {
        data = await schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });
      } catch (error) {
        if (error instanceof Yup.ValidationError) {
          throw AppError.fromResponse(400, {
            error: "Dados do lote invalidos.",
            errors: error.errors,
          });
        }
        throw error;
      }

      const recipients = [
        ...new Map(
          data.recipients.map((recipient) => [
            recipient.email.toLowerCase(),
            recipient,
          ])
        ).values(),
      ];
      const { subject, text, html } = data;
      const results = await Queue.addMany(
        BulkMail.key,
        recipients.map((recipient) => ({
          recipient,
          subject,
          text,
          ...(html ? { html } : {}),
        }))
      );
      const queued = [];
      const failed = [];
      results.forEach((result, index) => {
        const email = recipients[index].email;
        if (result.status === "fulfilled") {
          queued.push({ email, jobId: result.value.id });
        } else {
          monitoring.report(result.reason, { component: "api", requestId: req.requestId, queue: BulkMail.key });
          failed.push(email);
        }
      });
      const status =
        failed.length === 0 ? 202 : queued.length === 0 ? 503 : 207;
      return res.status(status).json({
        requested: data.recipients.length,
        duplicates: data.recipients.length - recipients.length,
        queuedCount: queued.length,
        failedCount: failed.length,
        queued,
        failed,
        message: failed.length
          ? "Alguns agendamentos nao foram confirmados pelo Redis."
          : "Emails agendados para envio em background.",
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default new BulkEmailsController();
