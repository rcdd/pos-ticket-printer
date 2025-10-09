import db from "../index.js";
import bcrypt from 'bcrypt';
const Users = db.users;

// Create and Save a new User
export const create = async (req, res) => {
    // Validate request
    if (!req.body.username) {
        res.status(400).send({
            message: "Username cannot be empty!"
        });
        return;
    }
    if (!req.body.password) {
        res.status(400).send({
            message: "Password cannot be empty!"
        });
        return;
    }

    if (req.body.role
        && !Object.values(db.UserRoles).includes(req.body.role)) {
        res.status(400).send({
            message: "Invalid role! Valid roles are: " + Object.values(db.UserRoles).join(', ') + "."
        });
        return;
    }

    // Create User
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = {
        name: req.body.name ? req.body.name : null,
        username: req.body.username,
        password: hashedPassword,
        role: req.body.role ? req.body.role : db.UserRoles.WAITER,
        isDeleted: false
    };

    // Save User in the database
    Users.create(user)
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while creating the User."
            });
        });
};

// Retrieve all Users from the database.
export const findAll = (req, res) => {
    Users.findAll({
        where: {isDeleted: false},
        attributes: {exclude: ['password', 'isDeleted']}
    })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Users."
            });
        });
};

// Find a single User with an id
export const findOne = (req, res) => {
    const id = req.params.id;

    Users.findByPk(id, {attributes: {exclude: ['password', 'isDeleted']}})
        .then(data => {
            if (data) {
                res.send(data);
            } else {
                res.status(404).send({
                    message: `User with id=${id} not found.`
                });
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Error retrieving User with id=" + id
            });
        });
};

// Update User by ID
export const update = (req, res) => {
    const id = req.body.id;

    const updateData = {
        name: req.body.name,
        username: req.body.username,
        role: req.body.role
    };

    if (req.body.role
        && !Object.values(db.UserRoles).includes(req.body.role)) {
        res.status(400).send({
            message: "Invalid role! Valid roles are: " + Object.values(db.UserRoles).join(', ') + "."
        });
        return;
    }

    // Only update password if provided
    if (req.body.password && req.body.password.trim() !== '') {
        updateData.password = req.body.password;
    }

    Users.update(updateData, {
        where: {id: id}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({
                    message: "User was updated successfully."
                });
            } else {
                res.send({
                    message: `Cannot update User with id=${id}.`
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating User with id=" + id,
                error: err.message || err
            });
        });
}

export const updatePassword = async (req, res) => {
    const id = req.body.id;
    const newPassword = req.body.password;

    if (!newPassword || newPassword.trim() === '') {
        res.status(400).send({
            message: "Password cannot be empty!"
        });
        return;
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    Users.update({password: newHashed}, {
        where: {id: id}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({
                    message: "Password was updated successfully."
                });
            } else {
                res.send({
                    message: `Cannot update password for User with id=${id}.`
                });
            }
        })
        .catch(err => {
            res.status(500).send({
                message: "Error updating password for User with id=" + id,
                error: err.message || err
            });
        });
}

// Soft delete User (isDeleted = true)
export const softDelete = (req, res) => {
    const id = req.params.id;

    Users.update({isDeleted: true}, {
        where: {id: id, isDeleted: false}
    })
        .then(num => {
            if (num[0] === 1) {
                res.send({
                    message: "User was deleted successfully!"
                });
            } else {
                res.send({
                    message: `Cannot delete User with id=${id}.`
                });
            }
        })
        .catch(() => {
            res.status(500).send({
                message: "Could not delete User with id=" + id
            });
        });
};

// Login user
export const login = async (req, res) => {
    const username = req.body.username;
    const _password = req.body.password;

    if (!username || !_password) {
        res.status(400).send({
            message: "Username and password are required!"
        });
        return;
    }

    Users.findOne({
        where: {username: username, isDeleted: false}
    })
        .then(async user => {
            if (!user) {
                return res.status(404).send({
                    message: "User not found!"
                });
            }

            const match = await bcrypt.compare(req.body.password, user.password);
            if (!match) {
                return res.status(401).send({message: "Invalid password!"});
            }

            // Exclude password from the response
            const {password, ...userWithoutPassword} = user.toJSON();

            res.send(userWithoutPassword);
        })
        .catch(() => {
            res.status(500).send({
                message: "Error logging in user"
            });
        });
};