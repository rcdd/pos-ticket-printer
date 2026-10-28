import http from "../http";
import {API_BASE_URL} from "../apiBaseUrl";

class OrderService {
    BASE_URL = API_BASE_URL;

    // {tableId?, note?, clientRequestId, items: [{productId|menuId, quantity}]}
    create(body) {
        return http.post(this.BASE_URL + "/order", body);
    }

    openTable(number) {
        return http.post(this.BASE_URL + "/table", {number});
    }

    getOrders(status = 'sent') {
        return http.get(this.BASE_URL + `/orders?status=${encodeURIComponent(status)}`);
    }

    // every order of a session, any status (reports / export)
    getSessionOrders(sessionId) {
        return http.get(this.BASE_URL + `/orders?sessionId=${encodeURIComponent(sessionId)}`);
    }

    getOrder(id) {
        return http.get(this.BASE_URL + `/order/${id}`);
    }

    getByNumber(number) {
        return http.get(this.BASE_URL + `/order/by-number/${number}`);
    }

    // body: {paymentMethod, discount, payments?} — pass through untouched so
    // split-payment parcels reach the API (destructuring dropped them once)
    pay(id, body) {
        return http.post(this.BASE_URL + `/order/${id}/pay`, body);
    }

    reprint(id) {
        return http.post(this.BASE_URL + `/order/${id}/reprint`);
    }

    // body: {targetTableId} | {newTableNumber} | {toStandalone: true}
    moveOrder(id, body) {
        return http.post(this.BASE_URL + `/order/${id}/move`, body);
    }

    // body: {all: true} | {itemIds: [...]} | {items: [{id, quantity}]}
    cancelItems(id, body) {
        return http.post(this.BASE_URL + `/order/${id}/cancel-items`, body);
    }

    getTables(status = 'open') {
        return http.get(this.BASE_URL + `/tables?status=${encodeURIComponent(status)}`);
    }

    getTable(id) {
        return http.get(this.BASE_URL + `/table/${id}`);
    }

    payTable(id, body) {
        return http.post(this.BASE_URL + `/table/${id}/pay`, body);
    }

    closeTableEmpty(id) {
        return http.post(this.BASE_URL + `/table/${id}/close-empty`);
    }

    // Public status (no auth): multi-terminal active? register session open?
    // Closes the kiosk (only works when called from the POS machine itself)
    closeKiosk() {
        return http.post(this.BASE_URL + "/system/close-kiosk");
    }

    getTerminalStatus() {
        return http.get(this.BASE_URL + "/system/terminal-status");
    }

    // Detailed info (admin): terminal IPs/URLs for the QR code
    getSystemInfo() {
        return http.get(this.BASE_URL + "/system/info");
    }

    getMultiTerminalOption() {
        return http.get(this.BASE_URL + "/option/multi-terminal");
    }

    setMultiTerminalOption(enabled) {
        return http.post(this.BASE_URL + "/option/multi-terminal", {enabled});
    }

    getOrderSplitOption() {
        return http.get(this.BASE_URL + "/option/order-split");
    }

    setOrderSplitOption(enabled) {
        return http.post(this.BASE_URL + "/option/order-split", {enabled});
    }
}

export default new OrderService();
