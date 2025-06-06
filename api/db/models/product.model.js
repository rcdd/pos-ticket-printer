module.exports.TypeStatus = Object.freeze({
    Drink: 'Drink',
    Food: 'Food',
});

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
        },
        type: {
            type: Sequelize.ENUM,
            values: Object.values(this.TypeStatus),
            defaultValue: this.TypeStatus.Drink
        },
        position: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};