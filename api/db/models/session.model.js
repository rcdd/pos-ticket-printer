export const SessionStatus = Object.freeze({
    OPEN: 'opened',
    CLOSED: 'closed'
})

export default (sequelize, Sequelize) => {
    return sequelize.define("session", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userOpenId: {
            type: Sequelize.INTEGER,
            references: {
                model: "users",
                key: "id"
            }
        },
        userCloseId: {
            type: Sequelize.INTEGER,
            references: {
                model: "users",
                key: "id"
            },
            allowNull: true
        },
        openedAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        },
        closedAt: {
            type: Sequelize.DATE,
            allowNull: true
        },
        status: {
            type: Sequelize.ENUM,
            values: Object.values(SessionStatus),
            defaultValue: SessionStatus.OPEN
        },
        initialAmount: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        },
        finalAmount: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        notes: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        // test/training session: recorded like any other but hidden from the
        // reports by default (audit-friendly)
        isTest: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    });
};
