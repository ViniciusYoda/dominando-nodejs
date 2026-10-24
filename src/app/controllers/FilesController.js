import { normalizeError } from "../errors";
import { AppError } from "../errors";
import { unlink } from "node:fs/promises";
import File from "../models/File";
import monitoring from "../../lib/monitoring";

class FilesController {
  async create(req, res) {
    try {
      if (!req.file) {
        throw AppError.fromResponse(400, {
          error: "Envie um arquivo no campo file.",
        });
      }
      try {
        const file = await File.create({
          name: req.file.originalname,
          path: req.file.filename,
        });
        return res.status(201).json(file);
      } catch (error) {
        await unlink(req.file.path).catch((cleanupError) => {
          monitoring.report(cleanupError, { component: "api", requestId: req.requestId });
        });
        throw error;
      }
    } catch (error) {
      throw normalizeError(error);
    }
  }
}

export default new FilesController();
