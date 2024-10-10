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
    if (!req.body.type) {
        res.status(400).send({
            message: "Type can not be empty!"
        });
        return;
    }

    if(req.body.type !== "Drink" && req.body.type !== "Food"){
        res.status(400).send({
            message: "Type must be do type Drink or Food!"
        });
        return;
    }

    // Validate if name is unique
    Product.findOne({
        where: {
            name: req.body.name
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
            image: req.body.image ? req.body.image : null // update to default one
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
    var condition = title ? {title: {[Op.like]: `%${title}%`}} : null;

    Product.findAll({where: condition})
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
        .catch(err => {
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

// Delete a Product with the specified id in the request
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
        .catch(err => {
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

