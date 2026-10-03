import { Router } from "express";
import customers from "./app/controllers/CustomersController";

const routes = new Router();

routes.get("/customers", customers.index.bind(customers));
routes.get("/customers/:id", customers.show.bind(customers));
routes.post("/customers", customers.create.bind(customers));
routes.put("/customers/:id", customers.update.bind(customers));
routes.delete("/customers/:id", customers.destroy.bind(customers));

export default routes;
