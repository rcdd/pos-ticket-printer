module.exports = (sequelize, Sequelize) => {
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
        quantity: {
            type: Sequelize.INTEGER
        }
    });
};
