import multer from "multer";
import { extname, resolve } from "path";
import crypto from "crypto"
import { mkdirSync } from "node:fs";

const uploadDirectory = resolve(__dirname, "..", "..", "tmp", "uploads");
mkdirSync(uploadDirectory, { recursive: true });


export default {
    storage: multer.diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
                crypto.randomBytes(16, (err, res) => {
                    if (err) return callback(err);

                    return callback(null, res.toString("hex") + extname(file.originalname))
                })
            },
    })
}
