const { resolve } = require("node:path");
const dotenv = require("dotenv");

// Caminho fixo para funcionar tambem no worker e no sequelize-cli.
dotenv.config({ path: resolve(__dirname, "..", "..", ".env"), quiet: true });

function integer(name, fallback, min, max = Number.MAX_SAFE_INTEGER) {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
    }
    return value;
}

function boolean(name, fallback) {
    const value = process.env[name];
    if (value === undefined) return fallback;
    if (value !== "true" && value !== "false") {
        throw new Error(`${name} deve ser true ou false.`);
    }
    return value === "true";
}

module.exports = { integer, boolean };
