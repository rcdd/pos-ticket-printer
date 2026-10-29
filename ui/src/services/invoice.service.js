import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";
import {PaymentMethods} from "../enums/PaymentMethodsEnum";

class InvoiceService {
    BASE_URL = API_BASE_URL;

    async addInvoice(sessionId, userId, items, totalAmount, discount, paymentMethod = PaymentMethods.find(p => p.value === 'cash').name, payments = undefined, discountNote = undefined) {
        const result = await http.post(this.BASE_URL + "/invoice/add", {
            sessionId,
            userId,
            items,
            totalAmount,
            discount,
            discountNote,
            paymentMethod,
            payments
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

    async getRecentDiscountNotes() {
        const result = await http.get(this.BASE_URL + "/invoice/discount-notes");

        return result.data;
    }

    async getFromSession(sessionId) {
        const result = await http.post(this.BASE_URL + "/invoice/session", {sessionId});

        return result.data;
    }
}

export default new InvoiceService();
