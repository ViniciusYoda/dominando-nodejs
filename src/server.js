import "./instrument";
import app from "./app";
import appConfig from "./config/app";
import monitoring from "./lib/monitoring";
import logger from "./lib/logger";
import Queue from "./app/lib/Queue";

const server = app.listen(appConfig.port, () => logger.info("api_started", { component: "api", port: appConfig.port }));
server.on("error", async (error) => {
    monitoring.report(error, { component: "api" });
    await monitoring.flush();
    process.exit(1);
});
let stopping = false;
async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
        try { await Queue.close(); }
        catch (error) { monitoring.report(error, { component: "api" }); process.exitCode = 1; }
        await monitoring.flush();
        clearTimeout(timeout);
    });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
