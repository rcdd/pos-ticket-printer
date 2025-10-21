import db from "../index.js";
import bcrypt from 'bcrypt';
import {Op, where} from "sequelize";
import jwt from "jsonwebtoken";
import {readOnboardingStatus, setOnboardingStatus} from "./options.controller.js";

const Users = db.users;
const {UserRoles} = db;

const USERNAME_CONFLICT_MESSAGE = "Esse nome de utilizador já existe. Escolha outro.";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

const toPublicUser = (userInstance) => {
    if (!userInstance) return null;
    const json = userInstance.toJSON();
    delete json.password;
    delete json.isDeleted;
    return json;
};

const createTokenForUser = (user) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT secret not configured (JWT_SECRET)");
    }
    const payload = {
        id: user.id,
        role: user.role,
    };
    const token = jwt.sign(payload, secret, {expiresIn: JWT_EXPIRES_IN});
    const decoded = jwt.decode(token);
    return {
        token,
        expiresAt: decoded?.exp ? decoded.exp * 1000 : null,
    };
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
        const onboardingCompleted = await readOnboardingStatus();
        const isAuthenticated = Boolean(req.user?.id);

        if (onboardingCompleted && !isAuthenticated) {
            res.status(401).send({message: "Autenticação necessária para criar utilizadores."});
            return;
        }

        if (!onboardingCompleted && role !== UserRoles.ADMIN) {
            res.status(400).send({message: "O primeiro utilizador deve ter perfil de administrador."});
            return;
        }

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
        if (!onboardingCompleted) {
            await setOnboardingStatus(true);
        }
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
    const username = String(req.body.username || '').trim();
    const rawPassword = String(req.body.password || '');

    if (!username || !rawPassword) {
        res.status(400).send({
            message: "Username and password are required!"
        });
        return;
    }

    try {
        const user = await Users.findOne({
            where: {username: username, isDeleted: false}
        });

        if (!user) {
            return res.status(404).send({
                message: "User not found!"
            });
        }

        const match = await bcrypt.compare(rawPassword, user.password);
        if (!match) {
            return res.status(401).send({message: "Invalid password!"});
        }

        const publicUser = toPublicUser(user);
        const {token, expiresAt} = createTokenForUser(user);

        res.send({
            token,
            expiresAt,
            user: publicUser,
        });
    } catch (err) {
        console.error("[users.login] error:", err);
        res.status(500).send({
            message: "Error logging in user"
        });
    }
};

export const me = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).send({message: "Token inválido"});
        }

        const user = await Users.findOne({
            where: {id: userId, isDeleted: false},
            attributes: {exclude: ['password', 'isDeleted']},
        });

        if (!user) {
            return res.status(404).send({message: "Utilizador não encontrado."});
        }

        res.send(user);
    } catch (err) {
        console.error("[users.me] error:", err);
        res.status(500).send({message: "Erro ao obter utilizador atual."});
    }
};
