import http from "../http";

class LicenseService {
    getStatus() {
        return http.get("/license/status");
    }

    apply(code) {
        return http.post("/license/apply", {code});
    }

    getDetails() {
        return http.get("/license/details");
    }

    remove() {
        return http.delete("/license");
    }
}

export default new LicenseService();
