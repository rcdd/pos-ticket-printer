module.exports = (sequelize, Sequelize) => {
    return sequelize.define("product", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING
        },
        price: {
            type: Sequelize.INTEGER
        },
        image: {
            type: Sequelize.STRING
        }
    });
};
