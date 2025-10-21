import db from "../index.js";

const Product = db.products;
const Zone = db.zones;

export const resetAll = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        await Product.update({isDeleted: true}, {
            where: {isDeleted: false},
            transaction,
        });

        await Zone.update({isDeleted: true}, {
            where: {isDeleted: false},
            transaction,
        });

        await transaction.commit();
        res.send({
            message: "Produtos e zonas removidos com sucesso.",
        });
    } catch (error) {
        await transaction.rollback();
        console.error("[inventory.resetAll] error:", error);
        res.status(500).send({
            message: "Erro ao remover produtos e zonas.",
            error: error?.message || error,
        });
    }
};
