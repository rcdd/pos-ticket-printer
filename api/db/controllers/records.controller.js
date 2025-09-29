const db = require("../index");
const Record = db.records;

exports.create = (req, res) => {
    // Validate request
    if (!req.body.items) {
        res.status(400).send({
            message: "Items can not be empty!"
        });
        return;
    }

    const data = req.body.items;

    // Save Option in the database
    Record.bulkCreate(data)
        .then(() => {
            res.send({message: "ok"});
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while creating the Product."
            });
        });
};

