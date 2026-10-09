export default (sequelize, Sequelize) => {
    return sequelize.define("option", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: Sequelize.STRING
        },
        // TEXT: some options hold JSON (additional printers, zone routes)
        // longer than a VARCHAR(255) — see ensureWidenedColumns in app.js
        value: {
            type: Sequelize.TEXT
        },
    });
};
