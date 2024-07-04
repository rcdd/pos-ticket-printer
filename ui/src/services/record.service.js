import http from "../http";

class RecordService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    addRecord(data) {
        return http.post(this.BASE_URL + "/record/add", {items: data});
    }
}

export default new RecordService();
