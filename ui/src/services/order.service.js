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

    // body: {itemIds: [...]} ou {all: true}; + adminUsername/adminPassword
    // quando quem chama não é admin
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

    // Estado público (sem auth): multiposto ativo? caixa aberta?
    getTerminalStatus() {
        return http.get(this.BASE_URL + "/system/terminal-status");
    }

    // Info detalhada (admin): IPs/URLs dos terminais para o QR code
    getSystemInfo() {
        return http.get(this.BASE_URL + "/system/info");
    }

    getMultiTerminalOption() {
        return http.get(this.BASE_URL + "/option/multi-terminal");
    }

    setMultiTerminalOption(enabled) {
        return http.post(this.BASE_URL + "/option/multi-terminal", {enabled});
    }
}

export default new OrderService();
