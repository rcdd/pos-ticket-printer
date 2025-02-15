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

// relations
db.invoices.hasMany(db.records, { foreignKey: 'invoiceId' });
db.records.belongsTo(db.invoices, { foreignKey: 'invoiceId' });

db.menus.belongsToMany(db.products, { through: db.menuProducts });
db.products.belongsToMany(db.menus, { through: db.menuProducts });

module.exports = db;
