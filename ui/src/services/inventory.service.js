import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class InventoryService {
    BASE_URL = API_BASE_URL;

    resetAll() {
        return http.delete(this.BASE_URL + "/inventory/reset");
    }
}

export default new InventoryService();
