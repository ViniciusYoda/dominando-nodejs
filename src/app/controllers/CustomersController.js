import Customer from "../models/Customer";

class CustomersController {
  constructor() {
    this.customers = [
      { id: 1, name: "Dev Samurai", site: "http://devsamurai.com.br" },
      { id: 2, name: "Google", site: "http://dgoogle.com" },
      { id: 3, name: "UOL", site: "http://uol.com.br" },
    ];
  }
  // Listragem do customer
  async index(req, res) {
    const data = await Customer.findAll({
      limit: 100,
    });
    return res.json(data);
  }

  // Recupera um customer
  show(req, res) {
    const id = parseInt(req.params.id);
    const customer = this.customers.find((items) => items.id === id);
    const status = customer ? 200 : 404;

    console.log("GET :: /customers/:id ", JSON.stringify(customer));

    return res.status(status).json(customer);
  }

  // Cria um customer
  create(req, res) {
    const { name, site } = req.body;
    const id = this.customers[this.customers.length - 1].id + 1;

    const newCustomer = { id, name, site };

    this.customers.push(newCustomer);

    return res.status(201).json(newCustomer);
  }

  // Atualiza um customer
  update(req, res) {
    const id = parseInt(req.params.id);
    const { name, site } = req.body;

    const index = this.customers.findIndex((item) => item.id === id);
    const status = index >= 0 ? 200 : 404;

    if (index >= 0) {
      this.customers[index] = { id: parseInt(id), name, site };
    }

    return res.status(status).json(this.customers[index]);
  }

  // Desstroi um customer
  destroy(req, res) {
    const id = parseInt(req.params.id);
    const index = this.customers.findIndex((item) => item.id === id);
    const status = index >= 0 ? 200 : 404;

    if (index >= 0) {
      this.customers.splice(index, 1);
    }

    return res.status(status).json();
  }
}

export default new CustomersController();
