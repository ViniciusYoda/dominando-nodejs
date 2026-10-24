import { integer } from "./env";

export default {
    concurrency: integer("QUEUE_CONCURRENCY", 2, 1, 20),
    bulkConcurrency: integer("BULK_MAIL_CONCURRENCY", 2, 1, 20),
    retries: integer("QUEUE_RETRIES", 3, 0, 100),
    backoff: integer("QUEUE_BACKOFF_MS", 1000, 1),
    shutdownTimeout: integer("QUEUE_SHUTDOWN_TIMEOUT_MS", 30000, 1),
};
