import Sequelize from "sequelize";

import config from "../config/database";

import User from "../app/models/User";
import Customer from "../app/models/Customer";
import Contact from "../app/models/Contact";

const models = [User, Customer, Contact];

class Database {
  constructor() {
    this.connection = new Sequelize(config);

    this.init();

    this.associate();
  }

  init() {
    models.forEach((model) => model.init(this.connection));
  }

  associate() {
    models.forEach((model) => {
      if (typeof model.associate === "function") {
        model.associate(this.connection.models);
      }
    });
  }
}

export default new Database();
