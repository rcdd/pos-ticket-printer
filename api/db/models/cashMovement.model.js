export default (sequelize, Sequelize) => {
    return sequelize.define("cashMovement", {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        sessionId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "sessions",
                key: "id"
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
        },
        type: {
            type: Sequelize.ENUM("CASH_IN", "CASH_OUT"),
            allowNull: false
        },
        amount: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        reason: {
            type: Sequelize.STRING(255),
            allowNull: true
        },
        userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "users",
                key: "id"
            }
        }
    });
};
