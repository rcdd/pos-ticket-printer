// Which browser origins may call the API.
//
// Besides the configured list (CLIENT_ORIGIN, e.g. the public /demo site),
// any page served from the local network is allowed, so the admin UI can be
// opened from another computer at http://<pc-ip>:3000 (same Wi-Fi, the
// event's router, or a cable straight to the PC). This only lifts the
// browser's cross-origin block: every request still needs a valid login.

export const DEFAULT_ORIGINS = ['http://localhost:8888', 'http://127.0.0.1:8888', 'http://localhost:3000'];

const isPrivateIPv4 = (host) => {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
        return false;
    }
    const [a, b] = parts;
    return a === 10
        || a === 127
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        // link-local: what a direct cable between two machines gets without a router
        || (a === 169 && b === 254);
};

export const isLocalNetworkOrigin = (origin) => {
    let url;
    try {
        url = new URL(origin);
    } catch {
        return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
    }
    const host = url.hostname;
    return host === 'localhost' || host === '[::1]' || isPrivateIPv4(host);
};

export const isAllowedOrigin = (origin, configured = DEFAULT_ORIGINS) => {
    // No Origin header: same-origin requests, curl, server-to-server.
    if (!origin) {
        return true;
    }
    return configured.includes(origin) || isLocalNetworkOrigin(origin);
};
