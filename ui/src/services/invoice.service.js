import http from "../http";
import {PaymentMethods} from "../enums/PaymentMethodsEnum";

class InvoiceService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

    async addInvoice(sessionId, userId, items, totalAmount, discount, paymentMethod = PaymentMethods.find(p => p.value === 'cash').name) {
        const result = await http.post(this.BASE_URL + "/invoice/add", {
            sessionId,
            userId,
            items,
            totalAmount,
            discount,
            paymentMethod
        });

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

    async GetFromSession(sessionId) {
        const result = await http.post(this.BASE_URL + "/invoice/session", {sessionId});

        return result.data;
    }
}

export default new InvoiceService();
