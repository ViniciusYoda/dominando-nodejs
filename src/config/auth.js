import "./env";

if (!process.env.AUTH_SECRET) {
    throw new Error("Configure AUTH_SECRET no .env.");
}

export default {
    secret: process.env.AUTH_SECRET,
    expiresIn: process.env.AUTH_EXPIRES_IN || "7d"
}
