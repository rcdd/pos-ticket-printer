module.exports = (sequelize, Sequelize) => {
    return sequelize.define("zones", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING
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