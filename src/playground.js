/* eslint-disable no-unused-vars */
import { Op } from "sequelize";

import "./database";

import Customers from "./app/models/Customer";
import Contact from "./app/models/Contact";

class Playground {
  static async play() {
    // const customerOne = await Customers.findOne({
    //   attributes: { exclude: ["status"] },
    // });

    // console.log(JSON.stringify(customerOne, null, 2));

    //const customerPk = await Customers.findByPk(1);

    // console.log(JSON.stringify(customerPk, null, 2));

    // const customers = await Customers.findAll({
    //   include: [
    //     {
    //       model: Contact,
    //       where: {
    //         status: "ACTIVE",
    //       },
    //       required: false,
    //     },
    //   ],
    //   where: {
    //     [Op.or]: {
    //       status: {
    //         [Op.in]: ["ACTIVE", "ARCHIVED"],
    //       },
    //       name: {
    //         [Op.like]: "Dev%",
    //       },
    //       createdAt: {
    //         [Op.between]: [new Date(2026, 10, 1), new Date(2026, 10, 7)],
    //       },
    //     },
    //   },
    //   order: [["name", "DESC"], ["createdAt"]],
    //   limit: 25,
    //   offset: 25 * 1 - 25,
    // });

    // const customers = await Customers.count();
    // const customers = await Customers.max("createdAt", {
    //   where: { status: "ARCHIVED" },
    // });
    // const customers = await Customers.min("createdAt", {
    //   where: { status: "ARCHIVED" },
    // });

    // const customers = await Customers.scope({
    //   method: ["created", new Date(2026, 10, 1)],
    // }).findAll();

    // const customers = await Customers.scope(["active", "samurai"]).findAll();

    // const customers = await Customers.scope([
    //   ["active"],
    //   { method: ["created", new Date(2026, 10, 1)] },
    // ]).findAll();

    // console.log(JSON.stringify(customers, null, 2));

    const customer = await Customers.create({
      name: "Superercado Zaza",
      email: "contato1@zaza.com.br",
    });

    console.log(JSON.stringify(customer, null, 2));
  }
}

Playground.play();
