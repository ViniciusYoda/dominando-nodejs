import "dotenv/config";

if (!process.env.AUTH_SECRET) {
    throw new Error("Configure AUTH_SECRET no .env.");
}

export default {
    secret: process.env.AUTH_SECRET,
    expiresIn: "7d"
}
