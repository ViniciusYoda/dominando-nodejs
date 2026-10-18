import { unlink } from "node:fs/promises";
import File from "../models/File";

class FilesController {
  async create(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: "Envie um arquivo no campo file." });
    }
    try {
      const file = await File.create({
        name: req.file.originalname,
        path: req.file.filename,
      });
      return res.status(201).json(file);
    } catch (error) {
      await unlink(req.file.path).catch(() => {});
      throw error;
    }
  }
}

export default new FilesController();
