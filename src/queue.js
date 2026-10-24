import "./instrument";
import { Queue } from "./app/lib/Queue";
import monitoring from "./lib/monitoring";
import logger from "./lib/logger";

const queue = new Queue({ worker: true });
let stopping = false;

async function shutdown() {
    if (stopping) return;
    stopping = true;
    try {
        await queue.close();
    } catch (error) {
        monitoring.report(error, { component: "worker" });
        process.exitCode = 1;
    } finally {
        await monitoring.flush();
    }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

queue.processQueue().then(() => {
    logger.info("worker_started", { component: "worker" });
}).catch(async (error) => {
    monitoring.report(error, { component: "worker" });
    process.exitCode = 1;
    await shutdown();
});
