"use strict";

const customers = [
  { name: "Ana Silva", email: "ana.silva@example.com", status: "ACTIVE" },
  { name: "Bruno Santos", email: "bruno.santos@example.com", status: "ACTIVE" },
  {
    name: "Carla Oliveira",
    email: "carla.oliveira@example.com",
    status: "ACTIVE",
  },
  { name: "Diego Costa", email: "diego.costa@example.com", status: "ARCHIVED" },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    return await queryInterface.bulkInsert(
      "customers",
      customers.map((customer) => ({
        ...customer,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface, Sequelize) {
    return await queryInterface.bulkDelete("customers", {
      email: {
        [Sequelize.Op.in]: customers.map((customer) => customer.email),
      },
    });
  },
};
