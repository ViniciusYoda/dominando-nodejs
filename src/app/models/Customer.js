import Sequelize, { Model, Op } from "sequelize";

class Customer extends Model {
  static init(sequelize) {
    super.init(
      {
        name: Sequelize.STRING,
        email: Sequelize.STRING,
        status: Sequelize.ENUM("ACTIVE", "ARCHIVED"),
      },
      {
        scopes: {
          active: {
            where: {
              status: "ACTIVE",
            },
            order: ["createdAt"],
          },
          samurai: {
            where: {
              name: "Dev Samurai",
            },
          },
          created: function created(date) {
            return {
              where: {
                createdAt: {
                  [Op.gte]: date,
                },
              },
            };
          },
        },
        hooks: {
          beforeValidate: (customer) => {
            if (customer.isNewRecord && customer.status === undefined) {
              customer.status = "ARCHIVED";
            }
          },
        },
        sequelize,
      }
    );
  }

  static associate(models) {
    this.hasMany(models.Contact, {
      foreignKey: "customer_id",
    });
  }
}

export default Customer;
