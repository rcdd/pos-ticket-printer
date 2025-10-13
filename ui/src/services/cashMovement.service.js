import http from "../http";

class CashMovementService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    async create(data) {
        return http.post(this.BASE_URL + "/cash-movement", data);
    }

    async getFromSession(sessionId) {
        const result = await http.get(this.BASE_URL + `/cash-movements/${sessionId}`);
        return result.data;
    }
}

export default new CashMovementService();
