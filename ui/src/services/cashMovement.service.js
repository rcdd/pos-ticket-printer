import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class CashMovementService {
    BASE_URL = API_BASE_URL;

    async create(data) {
        return http.post(this.BASE_URL + "/cash-movement", data);
    }

    async getFromSession(sessionId) {
        const result = await http.get(this.BASE_URL + `/cash-movements/${sessionId}`);
        return result.data;
    }
}

export default new CashMovementService();
