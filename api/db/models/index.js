const dbConfig = require("../db.config.js");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    port: dbConfig.port,
    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle
    }
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// tables
db.products = require("./product.model")(sequelize, Sequelize);
db.options = require("./option.model")(sequelize, Sequelize);
db.records = require("./record.model")(sequelize, Sequelize);
db.invoices = require("./invoice.model")(sequelize, Sequelize);
db.menus = require("./menu.model")(sequelize, Sequelize);
db.menuProducts = require("./menuProducts.model")(sequelize, Sequelize);
db.zones = require("./zone.model")(sequelize, Sequelize);
db.users = require("./user.model")(sequelize, Sequelize);
db.sessions = require("./session.model")(sequelize, Sequelize);

// relations
db.invoices.hasMany(db.records, {foreignKey: 'invoiceId'});
db.records.belongsTo(db.invoices, {foreignKey: 'invoiceId'});

db.menus.belongsToMany(db.products, {through: db.menuProducts});
db.products.belongsToMany(db.menus, {through: db.menuProducts});

db.records.belongsTo(db.products, {foreignKey: 'product', as: 'productItem'});
db.records.belongsTo(db.menus, {foreignKey: 'menu', as: 'menuItem'});

db.products.belongsTo(db.zones, {foreignKey: 'zoneId', as: 'zone'});
db.zones.hasMany(db.products, {foreignKey: 'zoneId', as: 'products'});

db.users.sync().then(() => {
    db.users.findOne({where: {role: 'admin', isDeleted: 0}}).then(user => {
        if (!user) {
            db.users.create({
                name: 'Admin',
                username: 'admin',
                password: 'admin123', //todo: ensure to hash passwords
                role: db.UserRoles.ADMIN,
            }).then(() => {
                console.log("Default admin user created: username 'admin', password 'admin123'");
            });
        }
    });
});

module.exports = db;
