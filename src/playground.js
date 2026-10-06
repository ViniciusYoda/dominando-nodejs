import "./database";

import Customers from "./app/models/Customer";

class Playground {
  static async play() {
    const customerrs = await Customers.findAll();

    console.log(JSON.stringify(customerrs, null, 2));
  }
}

Playground.play();
