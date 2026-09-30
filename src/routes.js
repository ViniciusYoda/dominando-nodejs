const { Router } = require("express")
const routes = new Router();

const customers = require("./app/controllers/CustomersController")

routes.get("/customers", customers.index.bind(customers))
routes.get("/customers/:id", customers.show.bind(customers))
routes.post("/customers", customers.create.bind(customers))
routes.put("/customers/:id", customers.update.bind(customers))
routes.delete("/customers/:id", customers.destroy.bind(customers))


module.exports = routes
