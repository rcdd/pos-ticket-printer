export default (sequelize, Sequelize) => {
    return sequelize.define("record", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        product: {
            type: Sequelize.INTEGER,
            references: {
                model: "products",
                key: "id"
            }
        },
        menu: {
            type: Sequelize.INTEGER,
            references: {
                model: "menus",
                key: "id"
            }
        },
        quantity: {
            type: Sequelize.INTEGER
        },
        price: {
            type: Sequelize.INTEGER
        },
        invoiceId: {
            type: Sequelize.INTEGER,
            references: {
                model: "invoices",
                key: "id"
            }
        }
    });
};
