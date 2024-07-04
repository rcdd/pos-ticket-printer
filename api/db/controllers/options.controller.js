const db = require("../models");
const Option = db.options;
const Op = db.Sequelize.Op;

const optionPrintName = 'printer';

exports.getPrinter = (req, res) => {
    Option.findOne({
        where: {
            name: optionPrintName
        }
    })
        .then(data => {
            if (data) {
                res.send({name: data.value});
            } else {
                res.status(404).send({
                    message: "Not found printer"
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error retrieving printer"
            });
        });
}

exports.setPrinter = (req, res) => {
    // Validate request
    if (!req.body.name) {
        res.status(400).send({
            message: "Name can not be empty!"
        });
        return;
    }

    const name = req.body.name;

    Option.findOne({
        where: {
            name: optionPrintName
        }
    }).then(data => {
        if (data) {
            Option.update({value: name}, {
                where: {name: optionPrintName}
            })
                .then(num => {
                    if (num.includes(1)) {
                        res.send({
                            message: "Printer was updated successfully."
                        });
                    } else {
                        res.send({
                            message: `Cannot update printer with name=${name}. Maybe printer was not found or req.body is empty!`
                        });
                    }
                })
                .catch(err => {
                    res.status(500).send({
                        message: "Error updating printer with name=" + name,
                        error: err
                    });
                });

            return;
        }

        // Save Option in the database
        Option.create({name: optionPrintName, value: req.body.name})
            .then(data => {
                res.send({name: data.value});
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while creating the Product."
                });
            });
    });
};

