import http from "../http";

// Configurações → Impressoras (main + additional printers, zone routing)
class PrintersService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    getConfig() {
        return http.get(this.BASE_URL + "/printers/config");
    }

    setEnabled(enabled) {
        return http.post(this.BASE_URL + "/printers/enabled", {enabled});
    }

    setRoutes(routes) {
        return http.post(this.BASE_URL + "/printers/routes", {routes});
    }

    updateMain(settings) {
        return http.put(this.BASE_URL + "/printers/main", settings);
    }

    // prints with the settings being edited (not saved yet)
    printSample(data) {
        return http.post(this.BASE_URL + "/printers/sample", data);
    }

    create(printer) {
        return http.post(this.BASE_URL + "/printers", printer);
    }

    update(id, printer) {
        return http.put(this.BASE_URL + `/printers/${encodeURIComponent(id)}`, printer);
    }

    remove(id) {
        return http.delete(this.BASE_URL + `/printers/${encodeURIComponent(id)}`);
    }

    testPrint(id) {
        return http.post(this.BASE_URL + `/printers/${encodeURIComponent(id)}/test`);
    }

    testConnection(host, port) {
        return http.post(this.BASE_URL + "/printers/test-connection", {host, port});
    }

    discover() {
        return http.get(this.BASE_URL + "/printers/discover");
    }
}

export default new PrintersService();
