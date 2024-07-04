import http from "../http";

class PrinterService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    getList() {
        return http.get(this.BASE_URL + "/printer/list");
    }

    print(data) {
        return http.post(this.BASE_URL + "/printer/print", data);
    }
}

export default new PrinterService();
