import db from "../index.js";

const CashMovement = db.cashMovements;
const Session = db.sessions;

export const create = async (req, res) => {
    try {
        const {sessionId, type, amount, reason, userId} = req.body;
        if (!sessionId || !["CASH_IN", "CASH_OUT"].includes(type)) {
            return res.status(400).json({message: "Invalid payload"});
        }

        if (!userId) {
            return res.status(400).json({message: "User ID is required"});
        }

        const value = Number(amount);
        if (Number.isNaN(value) || value <= 0) {
            return res.status(400).json({message: "Amount must be > 0"});
        }
        const session = await Session.findByPk(sessionId);
        if (!session) return res.status(404).json({message: "Session not found"});

        const item = await CashMovement.create({
            sessionId,
            type,
            amount: value,
            userId: userId,
            reason: reason || null
        });

        return res.status(201).json(item);
    } catch (err) {
        console.error("[cashMovement.create]", err);
        return res.status(500).json({message: "Internal error"});
    }
};

export const listBySession = async (req, res) => {
    try {
        const {sessionId} = req.params;
        const items = await CashMovement.findAll({
            where: {sessionId},
            order: [["createdAt", "ASC"]],
            include: [{
                model: db.users,
                as: 'user',
                attributes: ['id', 'username', 'name', 'role']
            }]
        });
        return res.json(items);
    } catch (err) {
        console.error("[cashMovement.listBySession]", err);
        return res.status(500).json({message: "Internal error"});
    }
};
