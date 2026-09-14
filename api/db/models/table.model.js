export const TableStatus = Object.freeze({
    OPEN: 'open',
    CLOSED: 'closed'
});

export default (sequelize, Sequelize) => {
    return sequelize.define("table", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        // physical table number (fixed on the floor: 1, 2, 3…)
        number: {
            type: Sequelize.STRING,
            allowNull: false
        },
        // group/tab letter at that table (A, B, C…), assigned by the system;
        // the tab presents itself as number+letter ("12B")
        letter: {
            type: Sequelize.STRING(3),
            allowNull: true
        },
        displayName: {
            type: Sequelize.VIRTUAL,
            get() {
                return `${this.getDataValue('number') ?? ''}${this.getDataValue('letter') ?? ''}`;
            }
        },
        status: {
            type: Sequelize.ENUM,
            values: Object.values(TableStatus),
            defaultValue: TableStatus.OPEN
        },
        sessionId: {
            type: Sequelize.INTEGER,
            references: {
                model: "sessions",
                key: "id"
            }
        },
        openedById: {
            type: Sequelize.INTEGER,
            references: {
                model: "users",
                key: "id"
            }
        },
        closedAt: {
            type: Sequelize.DATE,
            allowNull: true
        }
    }, {
        tableName: 'pos_tables'
    });
};
