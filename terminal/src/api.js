const BASE = import.meta.env?.VITE_API_BASE || '';
const TOKEN_KEY = 'tp_terminal_token';
const USER_KEY = 'tp_terminal_user';

export const getToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

export const setToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
    }
};

export const getStoredUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setStoredUser = (user) => {
    try {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
    } catch {
    }
};

export const clearSession = () => {
    setToken(null);
    setStoredUser(null);
};

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
    onUnauthorized = fn;
};

export async function api(path, {method = 'GET', body} = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(BASE + path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError('Sem ligação ao servidor. Verifique o Wi-Fi.', 0, null);
    }

    // The API renews the token on every authenticated request
    const renewed = res.headers.get('x-auth-token');
    if (renewed) setToken(renewed);

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        // only a token 401 (expired session) tears the session down; other
        // 401s (e.g. wrong admin credentials when voiding an item) don't log out
        if (res.status === 401 && data && typeof data === 'object' && data.code === 'AUTH_TOKEN_INVALID') {
            clearSession();
            if (onUnauthorized) onUnauthorized();
        }
        const message = (data && typeof data === 'object' && data.message)
            ? data.message
            : `Erro ${res.status}`;
        throw new ApiError(message, res.status, data);
    }

    return data;
}

export const newRequestId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
