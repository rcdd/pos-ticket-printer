// Audit trail for order lifecycle actions (moves, cancellations, …): one row
// per action with a free-form JSON payload, so future audit needs don't
// require schema changes.
export default (sequelize, Sequelize) => {
    return sequelize.define("orderEvent", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        orderId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "pos_orders",
                key: "id"
            }
        },
        // e.g. 'moved', 'items_cancelled'
        type: {
            type: Sequelize.STRING(32),
            allowNull: false
        },
        // JSON payload (stringified) with the action's details
        payload: {
            type: Sequelize.TEXT,
            allowNull: true,
            get() {
                const raw = this.getDataValue('payload');
                if (!raw) return null;
                try {
                    return JSON.parse(raw);
                } catch {
                    return raw;
                }
            },
            set(value) {
                this.setDataValue('payload', value == null ? null : JSON.stringify(value));
            }
        },
        userId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "users",
                key: "id"
            }
        }
    }, {
        tableName: 'pos_order_events',
        updatedAt: false,
        indexes: [
            {fields: ['orderId']}
        ]
    });
};
