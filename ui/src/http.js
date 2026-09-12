import axios from "axios";
import AuthService from "./services/auth.service";

const AUTH_TOKEN_HEADER = "x-auth-token";
const AUTH_EXPIRES_HEADER = "x-auth-expires-at";

const persistSessionFromHeaders = (headers) => {
    if (!headers) {
        return;
    }
    const renewedToken = headers[AUTH_TOKEN_HEADER];
    if (!renewedToken) {
        return;
    }
    const expiresHeader = headers[AUTH_EXPIRES_HEADER];
    const expiresAt = expiresHeader ? Number(expiresHeader) : null;
    AuthService.setSession({
        token: renewedToken,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : null
    });
};

const http = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393',
    headers: {
        "Content-type": "application/json"
    }
});

http.interceptors.request.use((config) => {
    const token = AuthService.getToken();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

http.interceptors.response.use(
    (response) => {
        persistSessionFromHeaders(response?.headers);
        return response;
    },
    (error) => {
        if (error?.response?.headers) {
            persistSessionFromHeaders(error.response.headers);
        }
        const status = error?.response?.status;
        if (status === 402 || status === 428) {
            const payload = error?.response?.data;
            if (typeof window !== "undefined" && window.dispatchEvent) {
                try {
                    window.dispatchEvent(new CustomEvent("license:updated", {detail: payload}));
                } catch (eventError) {
                    console.error("Falha ao emitir evento de licença:", eventError);
                }
            }
        }
        // Só o 401 de token (sessão expirada/inválida) derruba a sessão —
        // outros 401 (ex.: credenciais de admin erradas numa anulação) não.
        if (error?.response?.status === 401 && error?.response?.data?.code === "AUTH_TOKEN_INVALID") {
            AuthService.clearSession();
            if (typeof window !== "undefined" && window.dispatchEvent) {
                try {
                    window.dispatchEvent(new CustomEvent("auth:session-expired"));
                } catch (eventError) {
                    console.error("Falha ao emitir evento de sessão expirada:", eventError);
                }
            }
        }
        return Promise.reject(error);
    }
);

export default http;
