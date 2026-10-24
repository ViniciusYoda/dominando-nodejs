import monitoring from "./lib/monitoring";
import logger from "./lib/logger";

let exiting = false;
async function fatal(error) {
    if (exiting) return;
    exiting = true;
    logger.error("process_fatal", { component: "process" });
    monitoring.report(error, { component: "process" });
    await monitoring.flush();
    process.exit(1);
}

process.once("uncaughtException", fatal);
process.once("unhandledRejection", fatal);
