import http from "../http";

class MenuService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

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
