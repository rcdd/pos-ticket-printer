import http from "../http";

class UserService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

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
