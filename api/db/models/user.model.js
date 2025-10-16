export const UserRoles = Object.freeze({
    ADMIN: 'admin',
    CASHIER: 'cashier',
    WAITER: 'waiter'
});

export default (sequelize, Sequelize) => {
    return sequelize.define("user", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING
        },
        username: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        password: {
            type: Sequelize.STRING
        },
        role: {
            type: Sequelize.ENUM,
            values: Object.values(UserRoles),
            defaultValue: UserRoles.WAITER
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};
