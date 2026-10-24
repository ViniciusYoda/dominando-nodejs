import { integer } from "./env";

const environment = process.env.NODE_ENV || process.env.MODE_ENV || "development";
if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV deve ser development, test ou production.");
}

export default {
    environment,
    port: integer("PORT", 3000, 1, 65535),
};
