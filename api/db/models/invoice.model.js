module.exports.PaymentTypes = Object.freeze({
    CASH: 'cash',
    CARD: 'card',
    MBWAY: 'mbway',
    OTHER: 'other'
});

module.exports = (sequelize, Sequelize) => {
    return sequelize.define("invoice", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        total: {
            type: Sequelize.INTEGER,
        },
        sessionId: {
            type: Sequelize.INTEGER,
            references: {
                model: "sessions",
                key: "id"
            }
        },
        userId: {
            type: Sequelize.INTEGER,
            references: {
                model: "users",
                key: "id"
            }
        },
        paymentMethod: {
            type: Sequelize.ENUM,
            values: Object.values(this.PaymentTypes),
            defaultValue: this.PaymentTypes.CASH
        },
        discountPercent: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};
