import "./config/app";

import express from "express";
import errorHandler from "./app/middlewares/errorHandler";
import { NotFoundError } from "./app/errors";
import requestLogger from "./app/middlewares/requestLogger";

//import authMiddleware from "./app/middlewares/auth"
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
    this.server.use(requestLogger);
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: false }));
    //this.server.use(authMiddleware);
  }

  routes() {
    this.server.use(routes);
  }

  exceptionHandler() {
    this.server.use(() => {
      throw new NotFoundError("Rota nao encontrada.");
    });
    this.server.use(errorHandler);
  }
}

export default new App().server;
