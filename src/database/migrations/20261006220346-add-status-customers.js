"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return await queryInterface.addColumn("customers", "status", {
      type: Sequelize.ENUM("ACTIVE", "ARCHIVED"),
      allowNull: false,
      defaultValue: "ACTIVE",
    });
  },

  async down(queryInterface) {
    return await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("customers", "status", { transaction });
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_customers_status";',
        { transaction }
      );
    });
  },
};
