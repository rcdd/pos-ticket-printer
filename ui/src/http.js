import axios from "axios";
import AuthService from "./services/auth.service";

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
    (response) => response,
    (error) => {
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
        if (error?.response?.status === 401) {
            AuthService.clearSession();
        }
        return Promise.reject(error);
    }
);

export default http;
