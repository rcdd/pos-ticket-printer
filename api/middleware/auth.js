import jwt from "jsonwebtoken";

const TOKEN_HEADER = "authorization";
const BEARER_PREFIX = "bearer ";

export function authenticate(req, res, next) {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).send({message: "Auth secret not configured."});
        }

        const header = req.headers[TOKEN_HEADER];
        const token = extractToken(header) || req.query.token || req.body?.token;

        if (!token) {
            return res.status(401).send({message: "Token ausente."});
        }

        const decoded = jwt.verify(token, secret);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            tokenExpiresAt: decoded.exp ? decoded.exp * 1000 : null,
        };
        next();
    } catch (err) {
        console.error("[auth] token inválido:", err?.message || err);
        res.status(401).send({message: "Token inválido ou expirado."});
    }
}

export function optionalAuthenticate(req, res, next) {
    const header = req.headers[TOKEN_HEADER];
    const token = extractToken(header) || req.query.token || req.body?.token;

    if (!token) {
        return next();
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).send({message: "Auth secret not configured."});
        }

        const decoded = jwt.verify(token, secret);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            tokenExpiresAt: decoded.exp ? decoded.exp * 1000 : null,
        };
        next();
    } catch (err) {
        console.error("[auth optional] token inválido:", err?.message || err);
        res.status(401).send({message: "Token inválido ou expirado."});
    }
}

function extractToken(headerValue) {
    if (!headerValue || typeof headerValue !== "string") return null;

    const value = headerValue.trim();
    if (value.toLowerCase().startsWith(BEARER_PREFIX)) {
        return value.slice(BEARER_PREFIX.length).trim();
    }
    return value;
}
