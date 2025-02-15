const db = require("../models");
const Products = db.products;
const Menus = db.menus;

exports.findAll = async (req, res) => {
    try {
        const menus = await Menus.findAll({
            include: {
                model: Products,
                through: {attributes: []}, // Exclude join table attributes
                attributes: {exclude: ['isDeleted', 'createdAt', 'updatedAt']} // Exclude product attributes
            },
            attributes: {exclude: ['createdAt', 'updatedAt']} // Exclude menu attributes
        });

        res.status(200).send(menus);
    } catch (err) {
        console.error("Error fetching menus:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving the menus."
        });
    }
};

exports.create = async (req, res) => {
    try {
        // Validate request
        if (!req.body.menu || !req.body.menu.name) {
            res.status(400).send({
                message: "Menu name cannot be empty!"
            });
            return;
        }
        if (!req.body.menu || !req.body.menu.price) {
            res.status(400).send({
                message: "Menu price cannot be empty!"
            });
            return;
        }

        if (!req.body.products || req.body.products.length === 0) {
            res.status(400).send({
                message: "Products cannot be empty!"
            });
            return;
        }

        // Create Menu
        const menu = await Menus.create({
            name: req.body.menu.name,
            price: req.body.menu.price
        });

        // Find the products in the database
        const products = await Products.findAll({
            where: {id: req.body.products}
        });

        if (products.length !== req.body.products.length) {
            return res.status(400).send({message: "Some products were not found!"});
        }

        await menu.addProducts(products);

        res.status(201).send(menu);
    } catch (err) {
        console.error("Error creating menu:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while creating the Menu."
        });
    }
};

exports.update = async (req, res) => {
    try {
        const menuId = req.params.id;

        // Validate request
        if (!req.body.menu || !req.body.menu.name) {
            return res.status(400).send({message: "Menu name cannot be empty!"});
        }
        if (!req.body.menu.price) {
            return res.status(400).send({message: "Menu price cannot be empty!"});
        }
        if (!req.body.products || req.body.products.length === 0) {
            return res.status(400).send({message: "Products cannot be empty!"});
        }

        // Find the menu
        const menu = await Menus.findByPk(menuId);
        if (!menu) {
            return res.status(404).send({message: "Menu not found!"});
        }

        // Update menu details
        await menu.update({
            name: req.body.menu.name,
            price: req.body.menu.price
        });

        // Find the new products
        const products = await Products.findAll({
            where: {id: req.body.products}
        });

        if (products.length !== req.body.products.length) {
            return res.status(400).send({message: "Some products were not found!"});
        }

        await menu.setProducts(products);

        res.status(200).send({message: "Menu updated successfully!", menu});
    } catch (err) {
        console.error("Error updating menu:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while updating the Menu."
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const menuId = req.params.id;

        // Find the menu
        const menu = await Menus.findByPk(menuId);
        if (!menu) {
            return res.status(404).send({message: "Menu not found!"});
        }

        // Remove associations from join table
        await menu.setProducts([]); // Clears product associations

        // Delete menu
        await menu.destroy();

        res.status(200).send({message: "Menu deleted successfully!"});
    } catch (err) {
        console.error("Error deleting menu:", err);
        res.status(500).send({
            message: err.message || "Some error occurred while deleting the Menu."
        });
    }
};



