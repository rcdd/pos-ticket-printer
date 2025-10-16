import db from "../index.js";
import bcrypt from 'bcrypt';
import {Op} from "sequelize";

const Users = db.users;
const {UserRoles} = db;

const USERNAME_CONFLICT_MESSAGE = "Esse nome de utilizador já existe. Escolha outro.";

const toPublicUser = (userInstance) => {
    if (!userInstance) return null;
    const json = userInstance.toJSON();
    delete json.password;
    delete json.isDeleted;
    return json;
};

export const create = async (req, res) => {
    const username = String(req.body.username || '').trim();
    const rawPassword = String(req.body.password || '');
    const name = typeof req.body.name === 'string' && req.body.name.trim() !== ''
        ? req.body.name.trim()
        : null;
    const role = req.body.role ? String(req.body.role) : UserRoles.WAITER;

    if (!username) {
        res.status(400).send({
            message: "Username cannot be empty!"
        });
        return;
    }
    if (!rawPassword.trim()) {
        res.status(400).send({
            message: "Password cannot be empty!"
        });
        return;
    }

    if (role && !Object.values(UserRoles).includes(role)) {
        res.status(400).send({
            message: "Invalid role! Valid roles are: " + Object.values(UserRoles).join(', ') + "."
        });
        return;
    }

    try {
        const existingActive = await Users.findOne({
            where: {username, isDeleted: false}
        });
        if (existingActive) {
            res.status(409).send({message: USERNAME_CONFLICT_MESSAGE});
            return;
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        const payload = {
            name,
            username,
            password: hashedPassword,
            role,
            isDeleted: false
        };

        const created = await Users.create(payload);
        res.status(201).send(toPublicUser(created));
    } catch (err) {
        console.error("[users.create] error:", err);
        if (err?.name === 'SequelizeUniqueConstraintError') {
            res.status(409).send({message: USERNAME_CONFLICT_MESSAGE});
            return;
        }
        res.status(500).send({
            message:
                err?.message || "Some error occurred while creating the User."
        });
    }
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
export const update = async (req, res) => {
    const id = req.body.id;
    if (!id) {
        res.status(400).send({message: "User id is required."});
        return;
    }

    const updateData = {};

    if (req.body.name !== undefined) {
        updateData.name = typeof req.body.name === 'string' && req.body.name.trim() !== ''
            ? req.body.name.trim()
            : null;
    }

    if (req.body.username !== undefined) {
        const username = String(req.body.username || '').trim();
        if (!username) {
            res.status(400).send({message: "Username cannot be empty!"});
            return;
        }
        updateData.username = username;
    }

    if (req.body.role !== undefined) {
        updateData.role = req.body.role;
    }

    if (updateData.role
        && !Object.values(UserRoles).includes(updateData.role)) {
        res.status(400).send({
            message: "Invalid role! Valid roles are: " + Object.values(UserRoles).join(', ') + "."
        });
        return;
    }

    try {
        if (updateData.username) {
            const conflict = await Users.findOne({
                where: {
                    username: updateData.username,
                    isDeleted: false,
                    id: { [Op.ne]: id }
                }
            });
            if (conflict) {
                res.status(409).send({message: USERNAME_CONFLICT_MESSAGE});
                return;
            }
        }

        if (req.body.password && req.body.password.trim() !== '') {
            updateData.password = await bcrypt.hash(req.body.password, 10);
        }

        const [affected] = await Users.update(updateData, {
            where: {id: id}
        });

        if (affected === 1) {
            const fresh = await Users.findByPk(id);
            res.send({
                message: "User was updated successfully.",
                user: toPublicUser(fresh)
            });
        } else {
            res.status(404).send({
                message: `User with id=${id} not found.`
            });
        }
    } catch (err) {
        console.error("[users.update] error:", err);
        if (err?.name === 'SequelizeUniqueConstraintError') {
            res.status(409).send({message: USERNAME_CONFLICT_MESSAGE});
            return;
        }
        res.status(500).send({
            message: "Error updating User with id=" + id,
            error: err.message || err
        });
    }
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
