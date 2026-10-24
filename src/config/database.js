const { integer } = require("./env");

module.exports = {
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: integer("DB_PORT", 5432, 1, 65535),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "dominando-nodejs",
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
};
