import http from "../http";

class ProductService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

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
}

export default new ProductService();
