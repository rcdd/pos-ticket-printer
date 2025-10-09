export const PaymentTypes = Object.freeze({
    CASH: 'cash',
    CARD: 'card',
    MBWAY: 'mbway',
    OTHER: 'other'
});

export default (sequelize, Sequelize) => {
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
            values: Object.values(PaymentTypes),
            defaultValue: PaymentTypes.CASH
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
