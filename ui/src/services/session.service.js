import http from "../http";

class SessionService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    getAll() {
        return http.get(this.BASE_URL + "/sessions");
    }

    start(data) {
        return http.post(this.BASE_URL + "/session/start", data);
    }

    close(sessionId, data) {
        return http.post(this.BASE_URL + `/session/close/${sessionId}`, data);
    }

    update(data) {
        return http.put(this.BASE_URL + "/session/update", data);
    }

    getActiveSession() {
        return http.get(this.BASE_URL + "/session/active");
    }
}

export default new SessionService();
