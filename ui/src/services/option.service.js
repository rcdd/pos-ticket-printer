import http from "../http";

class OptionService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    getPrinter() {
        return http.get(this.BASE_URL + "/option/get-printer");
    }

    setPrinter(name) {
        return http.post(this.BASE_URL + "/option/set-printer", {name});
    }
}

export default new OptionService();
