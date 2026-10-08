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

    const customers = await Customers.findAll({
      include: [
        {
          model: Contact,
          where: {
            status: "ACTIVE",
          },
          required: false,
        },
      ],
      where: {
        [Op.or]: {
          status: {
            [Op.in]: ["ACTIVE", "ARCHIVED"],
          },
          name: {
            [Op.like]: "Dev%",
          },
          createdAt: {
            [Op.between]: [new Date(2026, 10, 1), new Date(2026, 10, 7)],
          },
        },
      },
      order: [["name", "DESC"], ["createdAt"]],
    });

    console.log(JSON.stringify(customers, null, 2));
  }
}

Playground.play();
