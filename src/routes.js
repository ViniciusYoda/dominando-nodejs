import { Router } from "express";
import customers from "./app/controllers/CustomersController";
import contacts from "./app/controllers/ContactsController";
import users from "./app/controllers/UsersController";

const routes = new Router();

routes.get("/customers", customers.index.bind(customers));
routes.get("/customers/:id", customers.show.bind(customers));
routes.post("/customers", customers.create.bind(customers));
routes.put("/customers/:id", customers.update.bind(customers));
routes.delete("/customers/:id", customers.destroy.bind(customers));

routes.get("/contacts", contacts.index.bind(contacts));
routes.get("/contacts/:id", contacts.show.bind(contacts));
routes.post("/contacts", contacts.create.bind(contacts));
routes.put("/contacts/:id", contacts.update.bind(contacts));
routes.delete("/contacts/:id", contacts.destroy.bind(contacts));

routes.get("/users", users.index.bind(users));
routes.get("/users/:id", users.show.bind(users));
routes.post("/users", users.create.bind(users));
routes.put("/users/:id", users.update.bind(users));
routes.delete("/users/:id", users.destroy.bind(users));

export default routes;
