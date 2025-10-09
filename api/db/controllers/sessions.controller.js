import db from "../index.js";

const Session = db.sessions;

// Create and Save a new Session
export const open = (req, res) => {
    // Validate request
    if (!req.body.userId) {
        res.status(400).send({
            message: "User ID can not be empty!"
        });
        return;
    }

    Session.findOne({where: {status: "opened"}})
        .then(data => {
            if (data) {
                res.status(400).send({
                    message: "There's already an opened session. Please close it before opening a new one."
                });
            } else {
                const session = {
                    userOpenId: req.body.userId,
                    initialAmount: req.body.initialAmount ? req.body.initialAmount : 0,
                    status: "opened",
                    notes: req.body.notes ? req.body.notes : null
                };

                // Save Session in the database
                Session.create(session)
                    .then(data => {
                        res.send(data);
                    }).catch(err => {
                    res.status(500).send({
                        message: err.message || "Some error occurred while creating the Session."
                    });
                });
            }
        }).catch(err => {
        res.status(500).send({
            message: err.message || "Some error occurred while checking for existing sessions."
        });
    });
}

// Close a session
export const closeSession = (req, res) => {
    const id = req.params.id;

    if (!req.body.userId) {
        res.status(400).send({
            message: "User ID can not be empty!"
        });
        return;
    }

    const updateData = {
        userCloseId: req.body.userId,
        closedAt: new Date(),
        status: "closed",
        finalAmount: req.body.finalAmount,
        notes: req.body.notes ? req.body.notes : null
    };

    Session.update(updateData, {
        where: {id: id, status: "opened"}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({
                    message: "Session was closed successfully."
                });
            } else {
                res.send({
                    message: `Cannot close Session with id=${id}. Maybe Session was not found or already closed!`
                });
            }
        }).catch(error => {
        res.status(500).send({
            message: "Error closing Session with id=" + id,
            error: error.message
        });
    });
}

// Retrieve all Sessions from the database.
export const findAll = (req, res) => {
    Session.findAll()
        .then(data => {
            res.send(data);
        }).catch(err => {
        res.status(500).send({
            message: err.message || "Some error occurred while retrieving sessions."
        });
    });
}

// Find a single Session with an id
export const findOne = (req, res) => {
    const id = req.params.id;

    Session.findByPk(id)
        .then(data => {
            if (data) {
                res.send(data);
            } else {
                res.status(404).send({
                    message: `Cannot find Session with id=${id}.`
                });
            }
        }).catch(error => {
        res.status(500).send({
            message: "Error retrieving Session with id=" + id,
            error: error.message
        });
    });
}

// Update a Session by the id in the request
export const update = (req, res) => {
    const id = req.params.id;

    Session.update(req.body, {
        where: {id: id}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({
                    message: "Session was updated successfully."
                });
            } else {
                res.send({
                    message: `Cannot update Session with id=${id}. Maybe Session was not found or req.body is empty!`
                });
            }
        }).catch((error) => {
        res.status(500).send({
            message: "Error updating Session with id=" + id,
            error: error.message
        });
    });
}

// Get last active session
export const getLastActiveSession = (req, res) => {
    Session.findOne({
        where: {status: "opened"},
        order: [['createdAt', 'DESC']]
    })
        .then(data => {
            if (data) {
                res.send(data);
            } else {
                res.status(404).send({
                    message: `No active session found.`
                });
            }
        }).catch(err => {
        res.status(500).send({
            message: "Error retrieving the last active session.",
            error: err.message
        });
    });
}