module.exports = {
    dialect: "postgres",
    host: "localhost",
    username: "postgres",
    password: "secret",
    database: "dominando-nodejs",
    define: {
        timestamps: true,
        underscored: true,
        underscoredAll: true,
    },
};
