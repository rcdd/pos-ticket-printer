export const OrderStatus = Object.freeze({
    SENT: 'sent',
    PAID: 'paid',
    CANCELLED: 'cancelled'
});

export default (sequelize, Sequelize) => {
    return sequelize.define("order", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        // Número sequencial por sessão — é o que sai no talão (#042)
        number: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        sessionId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "sessions",
                key: "id"
            }
        },
        tableId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "pos_tables",
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
        status: {
            type: Sequelize.ENUM,
            values: Object.values(OrderStatus),
            defaultValue: OrderStatus.SENT
        },
        // Soma dos itens ativos, em cêntimos (recalculada no servidor)
        total: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        invoiceId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "invoices",
                key: "id"
            }
        },
        printedAt: {
            type: Sequelize.DATE,
            allowNull: true
        },
        note: {
            type: Sequelize.STRING,
            allowNull: true
        },
        // Idempotência: o terminal gera um UUID por envio; retries não duplicam pedidos
        clientRequestId: {
            type: Sequelize.STRING(64),
            allowNull: true
        }
    }, {
        tableName: 'pos_orders',
        indexes: [
            {unique: true, fields: ['sessionId', 'number']},
            {unique: true, fields: ['clientRequestId']},
            {fields: ['status']},
            {fields: ['tableId']}
        ]
    });
};
