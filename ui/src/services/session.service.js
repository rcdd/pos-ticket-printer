import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class SessionService {
    BASE_URL = API_BASE_URL;

    getAll() {
        return http.get(this.BASE_URL + "/sessions");
    }

    start(data) {
        return http.post(this.BASE_URL + "/session/start", data);
    }

    close(sessionId, data) {
        return http.post(this.BASE_URL + `/session/close/${sessionId}`, data);
    }

    getActiveSession() {
        return http.get(this.BASE_URL + "/session/active");
    }
}

export default new SessionService();
