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
        if (error?.response?.status === 401) {
            AuthService.clearSession();
        }
        return Promise.reject(error);
    }
);

export default http;
