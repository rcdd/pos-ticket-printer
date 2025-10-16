const TOKEN_KEY = "ptp.auth.token";
const EXP_KEY = "ptp.auth.expiresAt";

class AuthService {
    constructor() {
        this._token = null;
        this._expiresAt = null;
        this._loadFromStorage();
    }

    _loadFromStorage() {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedExp = localStorage.getItem(EXP_KEY);
        this._token = storedToken || null;
        this._expiresAt = storedExp ? Number(storedExp) : null;
    }

    getToken() {
        return this._token;
    }

    getExpiresAt() {
        return this._expiresAt;
    }

    isAuthenticated() {
        if (!this._token) return false;
        if (!this._expiresAt) return true;
        return Date.now() < this._expiresAt;
    }

    setSession({token, expiresAt}) {
        this._token = token || null;
        this._expiresAt = expiresAt || null;

        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }

        if (expiresAt) {
            localStorage.setItem(EXP_KEY, String(expiresAt));
        } else {
            localStorage.removeItem(EXP_KEY);
        }
    }

    clearSession() {
        this.setSession({token: null, expiresAt: null});
    }
}

export default new AuthService();
