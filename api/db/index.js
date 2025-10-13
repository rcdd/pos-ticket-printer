import dbConfig from "./db.config.js";
import { Sequelize } from "sequelize";

import productModel from "./models/product.model.js";
import optionModel from "./models/option.model.js";
import recordModel from "./models/record.model.js";
import invoiceModel from "./models/invoice.model.js";
import menuModel from "./models/menu.model.js";
import menuProductsModel from "./models/menuProducts.model.js";
import zoneModel from "./models/zone.model.js";
import userModel from "./models/user.model.js";
import sessionModel from "./models/session.model.js";
import cashMovement from "./models/cashMovement.model.js";

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
db.products = productModel(sequelize, Sequelize);
db.options = optionModel(sequelize, Sequelize);
db.records = recordModel(sequelize, Sequelize);
db.invoices = invoiceModel(sequelize, Sequelize);
db.menus = menuModel(sequelize, Sequelize);
db.menuProducts = menuProductsModel(sequelize, Sequelize);
db.zones = zoneModel(sequelize, Sequelize);
db.users = userModel(sequelize, Sequelize);
db.sessions = sessionModel(sequelize, Sequelize);
db.cashMovements = cashMovement(sequelize, Sequelize);

// relations
db.invoices.hasMany(db.records, { foreignKey: 'invoiceId' });
db.records.belongsTo(db.invoices, { foreignKey: 'invoiceId' });

db.menus.belongsToMany(db.products, { through: db.menuProducts });
db.products.belongsToMany(db.menus, { through: db.menuProducts });

db.records.belongsTo(db.products, { foreignKey: 'product', as: 'productItem' });
db.records.belongsTo(db.menus, { foreignKey: 'menu', as: 'menuItem' });

db.products.belongsTo(db.zones, { foreignKey: 'zoneId', as: 'zone' });
db.zones.hasMany(db.products, { foreignKey: 'zoneId', as: 'products' });

db.sessions.hasMany(db.cashMovements, { foreignKey: 'sessionId', as: 'cashMovements' });
db.cashMovements.belongsTo(db.sessions, { foreignKey: 'sessionId', as: 'session' });

db.users.hasMany(db.cashMovements, { foreignKey: 'userId', as: 'cashMovements' });
db.cashMovements.belongsTo(db.users, { foreignKey: 'userId', as: 'user' });

export default db;
