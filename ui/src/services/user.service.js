import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class UserService {
    BASE_URL = API_BASE_URL;

    async getAll() {
        const result = await http.get(this.BASE_URL + "/users");
        return result.data;
    }

    get(id) {
        return http.get(this.BASE_URL + `/user/${id}`);
    }

    getCurrent() {
        return http.get(this.BASE_URL + "/user/me");
    }

    create(data) {
        return http.post(this.BASE_URL + "/user/add", data);
    }

    update(data) {
        return http.put(this.BASE_URL + "/user", data);
    }

    delete(id) {
        return http.delete(this.BASE_URL + `/user/${id}`);
    }

    login(username, password) {
        return http.post(this.BASE_URL + "/user/login", {username, password});
    }
}

export default new UserService();
