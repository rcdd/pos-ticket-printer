const UserRoles = {
    ADMIN: 'admin',
    CASHIER: 'cashier',
    WAITER: 'waiter'
};

module.exports.UserRoles = Object.freeze(UserRoles);

module.exports = (sequelize, Sequelize) => {
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
            unique: 'uniq_users_username',
        },
        password: {
            type: Sequelize.STRING
        },
        role: {
            type: Sequelize.ENUM,
            values: Object.values(this.UserRoles),
            defaultValue: this.UserRoles.WAITER
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });
};