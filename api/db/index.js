const dbConfig = require("./db.config.js");

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
db.products = require("./models/product.model")(sequelize, Sequelize);
db.options = require("./models/option.model")(sequelize, Sequelize);
db.records = require("./models/record.model")(sequelize, Sequelize);
db.invoices = require("./models/invoice.model")(sequelize, Sequelize);
db.menus = require("./models/menu.model")(sequelize, Sequelize);
db.menuProducts = require("./models/menuProducts.model")(sequelize, Sequelize);
db.zones = require("./models/zone.model")(sequelize, Sequelize);
db.users = require("./models/user.model")(sequelize, Sequelize);
db.sessions = require("./models/session.model")(sequelize, Sequelize);

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
                role: 'admin',
            }).then(() => {
                console.log("Default admin user created: username 'admin', password 'admin123'");
            });
        }
    });
});

module.exports = db;
