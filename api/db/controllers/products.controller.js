const db = require("../models");
const Product = db.products;
const Op = db.Sequelize.Op;

// Create and Save a new Product
exports.create = (req, res) => {
    // Validate request
    if (!req.body.name) {
        res.status(400).send({
            message: "Name can not be empty!"
        });
        return;
    }
    if (!req.body.price) {
        res.status(400).send({
            message: "Price can not be empty!"
        });
        return;
    }

    if (!req.body.zoneId) {
        res.status(400).send({
            message: "Zone must cannot be empty!"
        });
        return;
    }

    // Validate if name is unique
    Product.findOne({
        where: {
            name: req.body.name,
            isDeleted: false
        }
    }).then(data => {
        if (data) {
            res.status(400).send({
                message: "Name already exists!"
            });
            return;
        }

        // Create Product
        const product = {
            name: req.body.name,
            price: req.body.price,
            type: req.body.type,
            image: req.body.image ? req.body.image : null, // update to default one
            position: req.body.position ? req.body.position : 0,
            zoneId: req.body.zoneId,
            isDeleted: false
        };

        // Save Product in the database
        Product.create(product)
            .then(data => {
                res.send(data);
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the Product."
                });
            });
    });
};

// Retrieve all Products from the database.
exports.findAll = (req, res) => {
    const title = req.query.title;
    var condition = title ? {title: {[Op.like]: `%${title}%`}, isDeleted: false} : {isDeleted: false};

    Product.findAll({
        where: condition,
        attributes: {exclude: ['isDeleted']},
        include: [{
            model: db.zones,
            as: 'zone'
        }]
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving tutorials."
            });
        });
};

// Find a single Product with an id
exports.findOne = (req, res) => {
    const id = req.params.id;

    Product.findByPk(id)
        .then(data => {
            res.send(data);
        })
        .catch(() => {
            res.status(500).send({
                message: "Error retrieving Product with id=" + id
            });
        });
};

// Update a Product by the id in the request
exports.update = (req, res) => {
    const id = req.body.id;

    Product.update(req.body, {
        where: {id: id}
    })
        .then(num => {
            if (num === 1) {
                res.send({
                    message: "Product was updated successfully."
                });
            } else {
                res.send({
                    message: `Cannot update Product with id=${id}. Maybe Product was not found or req.body is empty!`
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating Product with id=" + id,
                error: err
            });
        });
};

exports.softDelete = (req, res) => {
    const id = req.params.id;

    Product.update({isDeleted: true}, {
        where: {id: id, isDeleted: false}
    })
        .then(num => {
            console.log(num);
            if (num.includes(1)) {
                res.send({
                    message: "Product was deleted successfully!"
                });
            } else {
                res.send({
                    message: `Cannot delete Product with id=${id}. Maybe Product was not found!`
                });
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Could not delete Product with id=" + id
            });
        });
};

exports.delete = (req, res) => {
    const id = req.params.id;

    Product.destroy({
        where: {id: id}
    })
        .then(num => {
            if (num === 1) {
                res.send({
                    message: "Product was deleted successfully!"
                });
            } else {
                res.send({
                    message: `Cannot delete Product with id=${id}. Maybe Product was not found!`
                });
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Could not delete Product with id=" + id
            });
        });
};

// Delete all Products from the database.
exports.deleteAll = (req, res) => {
    Product.destroy({
        where: {},
        truncate: false
    })
        .then(nums => {
            res.send({message: `${nums} Products were deleted successfully!`});
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while removing all tutorials."
            });
        });
};

// Update the position of products
exports.updatePositions = (req, res) => {
    const products = req.body.products;

    if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).send({
            message: "Products array is required and cannot be empty."
        });
    }

    const updates = products.map(product => {
        return Product.update({position: product.position}, {
            where: {id: product.id}
        });
    });

    Promise.all(updates)
        .then(() => {
            res.send({message: "Product positions updated successfully."});
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating product positions.",
                error: err
            });
        });
};

