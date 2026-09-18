import http from "../http";

class OrderService {
    BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393');

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

    getOrder(id) {
        return http.get(this.BASE_URL + `/order/${id}`);
    }

    getByNumber(number) {
        return http.get(this.BASE_URL + `/order/by-number/${number}`);
    }

    pay(id, {paymentMethod, discount}) {
        return http.post(this.BASE_URL + `/order/${id}/pay`, {paymentMethod, discount});
    }

    reprint(id) {
        return http.post(this.BASE_URL + `/order/${id}/reprint`);
    }

    // body: {itemIds: [...]} or {all: true}; + adminUsername/adminPassword
    // when the caller is not an admin
    cancelItems(id, body) {
        return http.post(this.BASE_URL + `/order/${id}/cancel-items`, body);
    }

    getTables(status = 'open') {
        return http.get(this.BASE_URL + `/tables?status=${encodeURIComponent(status)}`);
    }

    getTable(id) {
        return http.get(this.BASE_URL + `/table/${id}`);
    }

    payTable(id, {paymentMethod, discount}) {
        return http.post(this.BASE_URL + `/table/${id}/pay`, {paymentMethod, discount});
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
