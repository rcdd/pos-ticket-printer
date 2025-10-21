import http from "../http";

class InventoryService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    resetAll() {
        return http.delete(this.BASE_URL + "/inventory/reset");
    }
}

export default new InventoryService();
