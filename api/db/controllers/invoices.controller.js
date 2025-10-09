import db from "../index.js";
const Invoices = db.invoices;

export const create = (req, res) => {
    // Validate request
    if (!req.body.items) {
        res.status(400).send({
            message: "Items cannot be empty!"
        });
        return;
    }

    if (!req.body.sessionId) {
        res.status(400).send({
            message: "Session ID cannot be empty!"
        });
        return;
    }

    if (!req.body.userId) {
        res.status(400).send({
            message: "User ID cannot be empty!"
        });
        return;
    }

    if (req.body.paymentMethod
        && (req.body.paymentMethod !== "cash"
            && req.body.paymentMethod !== "card"
            && req.body.paymentMethod !== "mbway"
            && req.body.paymentMethod !== "other")) {
        res.status(400).send({
            message: "Invalid payment method! Valid methods are: 'cash', 'card', 'mbway' or 'other'."
        });
        return;
    }

    const records = [];
    req.body.items.forEach(element => {
        const item = {
            quantity: element.quantity
        }
        if (element.type === 'Menu') {
            item.menu = element.id;
        } else {
            item.product = element.id;
        }
        records.push(item);
    });

    const sessionId = req.body.sessionId;
    const userId = req.body.userId;
    const total = req.body.totalAmount ?? 0;
    const paymentMethod = req.body.paymentMethod ?? 'cash';
    const discountPercent = req.body.discount ?? 0;

    Invoices.create({records, total, userId, sessionId, paymentMethod, discountPercent}, {
        include: [db.records]
    })
        .then(data => {
            res.send({message: "ok", id: data.id});
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while creating the Invoice."
            });
        });
};

export const getAll = (req, res) => {
    Invoices.findAll({
        include: [
            {
                model: db.records,
                include: [
                    {
                        model: db.products, as: 'productItem',
                        include: [
                            {
                                model: db.zones, as: 'zone'
                            }
                        ]
                    },
                    {
                        model: db.menus, as: 'menuItem',
                        include: [
                            {
                                model: db.products, as: 'products'
                            }
                        ]
                    },
                ]
            }]
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while retrieving invoices."
            });
        });
}

export const revoke = (req, res) => {
    const id = req.body.id;
    if (!id) {
        res.status(400).send({
            message: "Id cannot be empty!"
        });
        return;
    }

    Invoices.update({isDeleted: true}, {
        where: {id: id}
    })
        .then(num => {
            if (num === 1) {
                res.send({
                    message: "Invoice was revoked successfully."
                });
            } else {
                res.send({
                    message: `Cannot revoke Invoice with id=${id}. Maybe Invoice was not found!`
                });
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Error revoking Invoice with id=" + id
            });
        });
}

export const getFromSession = (req, res) => {
    const sessionId = req.body.sessionId;
    if (!sessionId) {
        res.status(400).send({
            message: "Session ID cannot be empty!"
        });
        return;
    }

    Invoices.findAll({
        where: {sessionId: sessionId},
        include: [
            {
                model: db.records,
                include: [
                    {
                        model: db.products, as: 'productItem',
                        include: [
                            {
                                model: db.zones, as: 'zone'
                            }
                        ]
                    },
                    {
                        model: db.menus, as: 'menuItem',
                        include: [
                            {
                                model: db.products, as: 'products'
                            }
                        ]
                    },
                ]
            }]
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while retrieving invoices."
            });
        });
}
