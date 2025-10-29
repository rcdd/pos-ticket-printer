import http from "../http";

class PrinterService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    getList() {
        return http.get(this.BASE_URL + "/printer/list");
    }

    getUSBDevices() {
        return http.get(this.BASE_URL + "/printer/usb-devices");
    }

    testDirectConnection(config) {
        return http.post(this.BASE_URL + "/printer/test-direct-connection", { config });
    }

    printTicket(data) {
        return http.post(this.BASE_URL + "/printer/print-ticket", data);
    }

    printSessionSummary(data) {
        return http.post(this.BASE_URL + "/printer/print-session", data);
    }
}

export default new PrinterService();
