import http from "../http";

class InvoiceService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    async addInvoice(items, totalAmount) {
        const result = await http.post(this.BASE_URL + "/invoice/add", {items, totalAmount});

        return result.data.id;
    }

    async getInvoices() {
        const result = await http.post(this.BASE_URL + "/invoice/all");

        return result.data;
    }

    async revokeInvoice(id) {
        const result = await http.post(this.BASE_URL + "/invoice/revoke", {id});

        return result.data;
    }
}

export default new InvoiceService();
