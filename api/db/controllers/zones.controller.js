import db from "../index.js";
const Zone = db.zones;

// Create and Save a new Zone
export const create = (req, res) => {
    if (!req.body.name) {
        return res.status(400).send({message: "Name cannot be empty!"});
    }

    Zone.create({
        name: req.body.name,
        position: req.body.position || 0,
        isDeleted: false
    })
        .then(data => res.send(data))
        .catch(err => {
            res.status(500).send({message: err.message || "Error creating Zone."});
        });
};

// Get all Zones (non-deleted)
export const findAll = (req, res) => {
    Zone.findAll({
        where: {isDeleted: false},
        attributes: {exclude: ['isDeleted']}
    })
        .then(data => res.send(data))
        .catch(err => {
            res.status(500).send({message: err.message || "Error retrieving Zones."});
        });
};

// Get one Zone by ID
export const findOne = (req, res) => {
    const id = req.params.id;

    Zone.findByPk(id)
        .then(data => {
            if (data) res.send(data);
            else res.status(404).send({message: `Zone with id=${id} not found.`});
        })
        .catch(() => {
            res.status(500).send({message: "Error retrieving Zone with id=" + id});
        });
};

// Update Zone by ID
export const update = (req, res) => {
    const id = req.body.id;

    const updateData = {
        name: req.body.name,
        position: req.body.position
    };

    Zone.update(updateData, {
        where: {id: id}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({message: "Zone updated successfully."});
            } else {
                res.send({message: `Cannot update Zone with id=${id}.`});
            }
        })
        .catch(error => {
            res.status(500).send({message: "Error updating Zone with id=" + id, error: error.message || error});
        });
};

// Soft delete Zone (isDeleted = true)
export const softDelete = (req, res) => {
    const id = req.params.id;

    Zone.update({isDeleted: true}, {
        where: {id: id, isDeleted: false}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({message: "Zone was deleted successfully!"});
            } else {
                res.send({message: `Cannot delete Zone with id=${id}.`});
            }
        })
        .catch(() => {
            res.status(500).send({message: "Could not delete Zone with id=" + id});
        });
};

// Hard delete Zone
export const deleteZone = (req, res) => {
    const id = req.params.id;

    Zone.destroy({
        where: {id: id}
    })
        .then(num => {
            if (num === 1) {
                res.send({message: "Zone permanently deleted."});
            } else {
                res.send({message: `Cannot delete Zone with id=${id}.`});
            }
        })
        .catch(() => {
            res.status(500).send({message: "Could not delete Zone with id=" + id});
        });
};

// Update the position of multiple zones
export const updatePositions = (req, res) => {
    const zones = req.body.zones;

    if (!Array.isArray(zones) || zones.length === 0) {
        return res.status(400).send({
            message: "Zones array is required and cannot be empty."
        });
    }

    const updates = zones.map(zone => {
        return Zone.update({position: zone.position}, {
            where: {id: zone.id}
        });
    });

    Promise.all(updates)
        .then(() => {
            res.send({message: "Zone positions updated successfully."});
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating zone positions.",
                error: err
            });
        });
};
