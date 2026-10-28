import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class PrinterService {
    BASE_URL = API_BASE_URL;

    getList() {
        return http.get(this.BASE_URL + "/printer/list");
    }

    printTicket(data) {
        return http.post(this.BASE_URL + "/printer/print-ticket", data);
    }

    testDrawer() {
        return http.post(this.BASE_URL + "/printer/test-drawer");
    }

    printLayoutSample(ticketType) {
        return http.post(this.BASE_URL + "/printer/test-layout", {ticketType});
    }

    printSessionSummary(data) {
        return http.post(this.BASE_URL + "/printer/print-session", data);
    }
}

export default new PrinterService();
