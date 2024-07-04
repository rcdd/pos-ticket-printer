module.exports = (sequelize, Sequelize) => {
    return sequelize.define("option", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING
        },
        value: {
            type: Sequelize.STRING
        },
    });
};
