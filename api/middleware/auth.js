import {refreshAuthToken, AUTH_TOKEN_HEADER, AUTH_EXPIRES_HEADER} from "../services/token.service.js";

const TOKEN_HEADER = "authorization";
const BEARER_PREFIX = "bearer ";

function setRenewedHeaders(res, token, expiresAt) {
    if (!token) {
        return;
    }
    res.setHeader(AUTH_TOKEN_HEADER, token);
    if (expiresAt) {
        res.setHeader(AUTH_EXPIRES_HEADER, String(expiresAt));
    }
}

function buildUserFromSession(session) {
    return {
        id: session.payload.id,
        role: session.payload.role,
        tokenExpiresAt: session.expiresAt || session.previousExpiresAt || null,
    };
}

function handleAuthError(res, err, contextLabel) {
    const message = err?.message || err;
    if (typeof message === "string" && message.includes("JWT secret not configured")) {
        console.error(`${contextLabel} ${message}`);
        return res.status(500).send({message: "Auth secret not configured."});
    }
    console.error(`${contextLabel} token inválido:`, message);
    return res.status(401).send({message: "Token inválido ou expirado."});
}

function refreshUserSession(token, res) {
    const session = refreshAuthToken(token);
    setRenewedHeaders(res, session.renewedToken, session.expiresAt);
    return buildUserFromSession(session);
}

export function authenticate(req, res, next) {
    try {
        const header = req.headers[TOKEN_HEADER];
        const token = extractToken(header) || req.query.token || req.body?.token;

        if (!token) {
            return res.status(401).send({message: "Token ausente."});
        }

        req.user = refreshUserSession(token, res);
        next();
    } catch (err) {
        handleAuthError(res, err, "[auth]");
    }
}

export function optionalAuthenticate(req, res, next) {
    const header = req.headers[TOKEN_HEADER];
    const token = extractToken(header) || req.query.token || req.body?.token;

    if (!token) {
        return next();
    }

    try {
        req.user = refreshUserSession(token, res);
        next();
    } catch (err) {
        handleAuthError(res, err, "[auth optional]");
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
