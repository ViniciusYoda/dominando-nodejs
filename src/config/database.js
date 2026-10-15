require("dotenv/config");

module.exports = {
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "dominando-nodejs",
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
};
