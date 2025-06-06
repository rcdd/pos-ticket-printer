const db = require("../models");
const Invoices = db.invoices;

exports.create = (req, res) => {
    // Validate request
    if (!req.body.items) {
        res.status(400).send({
            message: "Items cannot be empty!"
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
    const total = req.body.totalAmount ?? 0;

    Invoices.create({records, total}, {
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

exports.getAll = (req, res) => {
    Invoices.findAll({
        include: [{
            model: db.records, include: [{
                model: db.products, as: 'productItem',
            }, {
                model: db.menus, as: 'menuItem', include: [{
                    model: db.products, as: 'products'
                }]
            },]
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

exports.revoke = (req, res) => {
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
