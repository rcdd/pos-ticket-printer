import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class ZoneService {
    BASE_URL = API_BASE_URL;

    getAll() {
        return http.get(this.BASE_URL + "/zones");
    }

    create(data) {
        return http.post(this.BASE_URL + "/zone/add", data);
    }

    update(data) {
        return http.put(this.BASE_URL + "/zone/update", data);
    }

    delete(id) {
        return http.delete(this.BASE_URL + `/zone/${id}`);
    }

    reorder(data) {
        return http.post(this.BASE_URL + "/zone/reorder",  data);
    }
}

export default new ZoneService();
