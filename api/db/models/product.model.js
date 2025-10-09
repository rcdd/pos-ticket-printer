export default (sequelize, Sequelize) => {
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
        zoneId: {
            type: Sequelize.INTEGER,
            references: {
                model: 'zones',
                key: 'id'
            },
            allowNull: true
        },
        position: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        theme: {
            type: Sequelize.STRING,
            allowNull: true
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};