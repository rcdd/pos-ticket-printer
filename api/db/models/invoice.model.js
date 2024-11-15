module.exports = (sequelize, Sequelize) => {
    return sequelize.define("invoice", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        total: {
            type: Sequelize.DECIMAL(10,2) ,
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};
