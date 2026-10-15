import "dotenv/config";

import express from "express";
import Youch from "youch";

import routes from "./routes";

import "./database";

class App {
  constructor() {
    this.server = express();
    this.middlewares();
    this.routes();
    this.exceptionHandler();
  }

  middlewares() {
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: false }));
  }

  routes() {
    this.server.use(routes);
  }

  exceptionHandler() {
    this.server.use(async (err, req, res, next) => {
      if (res.headersSent) return next(err);
      const status = err.status >= 400 && err.status < 600 ? err.status : 500;
      if ((process.env.NODE_ENV || process.env.MODE_ENV) === "development") {
        const errors = await new Youch(err, req).toJSON();
        return res.status(status).json(errors);
      }
      return res.status(status).json({
        error:
          status === 500 ? "Erro interno do servidor." : "Requisição inválida.",
      });
    });
  }
}

export default new App().server;
