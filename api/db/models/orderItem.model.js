export const OrderItemStatus = Object.freeze({
    ACTIVE: 'active',
    CANCELLED: 'cancelled'
});

export default (sequelize, Sequelize) => {
    return sequelize.define("orderItem", {
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
        productId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "products",
                key: "id"
            }
        },
        menuId: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "menus",
                key: "id"
            }
        },
        // Name at order time: tickets and history stay stable even if
        // the product is renamed/deleted later
        nameSnapshot: {
            type: Sequelize.STRING,
            allowNull: false
        },
        quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        // Unit price in cents at order time
        price: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        status: {
            type: Sequelize.ENUM,
            values: Object.values(OrderItemStatus),
            defaultValue: OrderItemStatus.ACTIVE
        },
        cancelledById: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: "users",
                key: "id"
            }
        },
        cancelledAt: {
            type: Sequelize.DATE,
            allowNull: true
        }
    }, {
        tableName: 'pos_order_items',
        indexes: [
            {fields: ['orderId']}
        ]
    });
};
