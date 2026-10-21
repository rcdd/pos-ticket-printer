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
        // "Metro de Cerveja": a direct sale of one unit prints this many
        // individual tickets (senhas) instead of one; 1 = the usual behaviour
        ticketsPerUnit: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        // text printed on each of those tickets (e.g. "Cerveja"); null = the
        // product name
        ticketLabel: {
            type: Sequelize.STRING,
            allowNull: true
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};