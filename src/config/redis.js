import { integer } from "./env";

const port = integer("REDIS_PORT", 6379, 1, 65535);
const db = integer("REDIS_DB", 0, 0);

export default {
    host: process.env.REDIS_HOST || "localhost",
    port,
    db,
    password: process.env.REDIS_PASSWORD || undefined,
    connect_timeout: 5000,
    retry_strategy: ({ attempt, total_retry_time }) => {
        if (attempt > 3 || total_retry_time > 5000) {
            return new Error("Não foi possível conectar ao Redis.");
        }
        return Math.min(attempt * 200, 1000);
    },
};
