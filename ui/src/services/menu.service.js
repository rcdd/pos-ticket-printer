import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class MenuService {
    BASE_URL = API_BASE_URL;

    getAll() {
        return http.get(this.BASE_URL + "/menus");
    }

    create(data) {
        return http.post(this.BASE_URL + "/menu/add", data);
    }

    update(id, data) {
        return http.put(this.BASE_URL + `/menu/${id}`, data);
    }

    delete(id) {
        return http.delete(this.BASE_URL + `/menu/${id}`);
    }
}

export default new MenuService();
