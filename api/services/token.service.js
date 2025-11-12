import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

export const AUTH_TOKEN_HEADER = "x-auth-token";
export const AUTH_EXPIRES_HEADER = "x-auth-expires-at";

function ensureSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT secret not configured (JWT_SECRET).");
    }
    return secret;
}

function toMillis(expSeconds) {
    return expSeconds ? expSeconds * 1000 : null;
}

export function generateAuthToken(payload) {
    if (!payload || !payload.id || !payload.role) {
        throw new Error("Token payload requires id and role.");
    }

    const token = jwt.sign(
        {id: payload.id, role: payload.role},
        ensureSecret(),
        {expiresIn: JWT_EXPIRES_IN}
    );

    const decoded = jwt.decode(token);

    return {
        token,
        expiresAt: toMillis(decoded?.exp),
    };
}

export function refreshAuthToken(rawToken) {
    if (!rawToken) {
        throw new Error("Token ausente.");
    }

    const decoded = jwt.verify(rawToken, ensureSecret());
    const payload = {
        id: decoded.id,
        role: decoded.role,
    };

    const {token: renewedToken, expiresAt} = generateAuthToken(payload);

    return {
        payload,
        renewedToken,
        expiresAt,
        previousExpiresAt: toMillis(decoded?.exp),
    };
}
