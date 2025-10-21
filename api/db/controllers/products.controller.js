import db from "../index.js";

const Product = db.products;
const Op = db.Sequelize.Op;

// Create and Save a new Product
export const create = (req, res) => {
    // Validate request
    if (!req.body.name) {
        res.status(400).send({
            message: "Name can not be empty!"
        });
        return;
    }
    if (req.body.price == null) {
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

    // Check if product already exists in the same zone but was deleted
    Product.findOne({
        where: {
            name: req.body.name,
            zoneId: req.body.zoneId,
            isDeleted: true
        }
    }).then(existingProduct => {
        if (existingProduct) {
            existingProduct.isDeleted = false;
            existingProduct.price = req.body.price;
            existingProduct.position = req.body.position ? req.body.position : existingProduct.position;
            existingProduct.theme = req.body.theme ? req.body.theme : existingProduct.theme;

            existingProduct.save()
                .then(data => {
                    res.send(data);
                })
                .catch(err => {
                    res.status(500).send({
                        message:
                            err.message || "Some error occurred while restoring the Product."
                    });
                });
        }
    })

    // Create Product
    const product = {
        name: req.body.name,
        price: req.body.price,
        position: req.body.position ? req.body.position : 0,
        zoneId: req.body.zoneId,
        theme: req.body.theme ? req.body.theme : null,
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
};

// Retrieve all Products from the database.
export const findAll = (req, res) => {
    const nameFilter = req.query.name;
    const condition = nameFilter ? {name: {[Op.like]: `%${nameFilter}%`}, isDeleted: false} : {isDeleted: false};

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
export const findOne = (req, res) => {
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
export const update = (req, res) => {
    const id = req.body.id;
    const payload = req.body;
    payload.isDeleted = false;

    Product.update(payload, {
        where: {id: id}
    })
        .then(num => {
            if (num.includes(1)) {
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

export const softDelete = (req, res) => {
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

export const deleteProduct = (req, res) => {
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
export const deleteAll = (req, res) => {
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

export const softDeleteByZone = async (req, res) => {
    const zoneId = req.params.zoneId;

    if (!zoneId) {
        return res.status(400).send({message: "Zone id is required."});
    }

    try {
        const [updated] = await Product.update({isDeleted: true}, {
            where: {zoneId, isDeleted: false}
        });

        res.send({
            message: updated > 0
                ? "Produtos da zona removidos com sucesso."
                : "Não existem produtos ativos nesta zona.",
            affected: updated,
        });
    } catch (error) {
        console.error("[products.softDeleteByZone] error:", error);
        res.status(500).send({
            message: "Erro ao remover produtos da zona.",
            error: error?.message || error,
        });
    }
};

export const softDeleteAllProducts = async (req, res) => {
    try {
        const [updated] = await Product.update({isDeleted: true}, {
            where: {isDeleted: false}
        });

        res.send({
            message: updated > 0
                ? "Todos os produtos foram removidos com sucesso."
                : "Não existem produtos ativos para remover.",
            affected: updated,
        });
    } catch (error) {
        console.error("[products.softDeleteAllProducts] error:", error);
        res.status(500).send({
            message: "Erro ao remover todos os produtos.",
            error: error?.message || error,
        });
    }
};

// Update the position of products
export const updatePositions = (req, res) => {
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
