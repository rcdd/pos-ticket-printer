// Split payments: one row per parcel of an invoice (a group splitting the
// bill, possibly across different methods). Invoices without rows are
// single-payment — their method/total live on the invoice itself.
export default (sequelize, Sequelize) => {
    return sequelize.define("invoicePayment", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        invoiceId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: "invoices",
                key: "id"
            }
        },
        method: {
            type: Sequelize.ENUM,
            values: ['cash', 'card', 'mbway', 'other'],
            allowNull: false
        },
        // parcel amount in cents; parcels always sum to the invoice total
        amount: {
            type: Sequelize.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'invoice_payments',
        updatedAt: false,
        indexes: [
            {fields: ['invoiceId']}
        ]
    });
};
