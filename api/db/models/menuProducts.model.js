export default (sequelize, Sequelize) => {
    return sequelize.define("menuProduct", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        menuId: {
            type: Sequelize.INTEGER,
            references: {
                model: 'menus',
                key: 'id'
            }
        },
        productId: {
            type: Sequelize.INTEGER,
            references: {
                model: 'products',
                key: 'id'
            }
        }
    });
};
