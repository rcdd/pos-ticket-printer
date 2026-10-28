import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class ProductService {
    BASE_URL = API_BASE_URL;

    getAll() {
        return http.get(this.BASE_URL + "/db/products");
    }

    create(data) {
        return http.post(this.BASE_URL + "/db/product", data);
    }

    update(data) {
        return http.put(this.BASE_URL + "/db/product/", data);
    }

    delete(id) {
        return http.delete(this.BASE_URL + `/db/product/${id}`);
    }

    deleteByZone(zoneId) {
        return http.delete(this.BASE_URL + `/db/product/zone/${zoneId}`);
    }

    deleteAll() {
        return http.delete(this.BASE_URL + "/db/products");
    }

    reorder(data) {
        return http.post(this.BASE_URL + "/db/product/reorder", {products: data});
    }

    getTopSelling(limit = 6) {
        return http.get(this.BASE_URL + `/reports/top-products?limit=${limit}`);
    }
}

export default new ProductService();
