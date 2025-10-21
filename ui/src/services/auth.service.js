const TOKEN_KEY = "ptp.auth.token";
const EXP_KEY = "ptp.auth.expiresAt";
const USER_KEY = "user";

class AuthService {
    constructor() {
        this._token = null;
        this._expiresAt = null;
        this._user = null;
        this._loadFromStorage();
    }

    _loadFromStorage() {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedExp = localStorage.getItem(EXP_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        this._token = storedToken || null;
        this._expiresAt = storedExp ? Number(storedExp) : null;
        if (storedUser) {
            try {
                this._user = JSON.parse(storedUser);
            } catch (error) {
                console.warn("Não foi possível ler o utilizador guardado:", error);
                this._user = null;
                localStorage.removeItem(USER_KEY);
            }
        } else {
            this._user = null;
        }
    }

    getToken() {
        return this._token;
    }

    getExpiresAt() {
        return this._expiresAt;
    }

    getUser() {
        return this._user;
    }

    setUser(user) {
        if (user) {
            this._user = user;
            try {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            } catch (error) {
                console.error("Não foi possível guardar o utilizador:", error);
            }
        } else {
            this._user = null;
            localStorage.removeItem(USER_KEY);
        }
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
        this.setUser(null);
    }
}

export default new AuthService();
