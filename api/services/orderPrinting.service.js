import {printOrderTicket, printOrderVoid} from './printing/printService.js';
import {getPrinterVariable, getHeadersVariable} from '../db/controllers/options.controller.js';

// Printing is best-effort: the order is already saved by the time this runs.
// A printer failure returns {printed:false, error} and the terminal offers
// "Reimprimir" — an order is never lost because of paper.

const activeItems = (order) =>
    (order.items ?? []).filter((item) => item.status !== 'cancelled');

export async function tryPrintOrderTicket(order, {reprint = false} = {}) {
    try {
        const printerName = await getPrinterVariable();
        if (!printerName) {
            return {printed: false, error: 'Impressora não configurada.'};
        }

        await printOrderTicket({
            printerName,
            headers: await getHeadersVariable(),
            number: order.number,
            tableNumber: order.table ? (order.table.displayName || order.table.number) : null,
            items: activeItems(order),
            note: order.note,
            waiterName: order.user?.name || order.user?.username || null,
            createdAt: order.createdAt,
            reprint,
        });
        return {printed: true, error: null};
    } catch (error) {
        console.error(`[print] Falha a imprimir pedido #${order.number}:`, error?.message || error);
        return {printed: false, error: String(error?.message || error)};
    }
}

export async function tryPrintOrderVoid(order, cancelledItems, approvedByName) {
    try {
        const printerName = await getPrinterVariable();
        if (!printerName) {
            return {printed: false, error: 'Impressora não configurada.'};
        }

        await printOrderVoid({
            printerName,
            headers: await getHeadersVariable(),
            number: order.number,
            tableNumber: order.table ? (order.table.displayName || order.table.number) : null,
            items: cancelledItems,
            approvedByName,
            cancelledAt: new Date(),
        });
        return {printed: true, error: null};
    } catch (error) {
        console.error(`[print] Falha a imprimir anulação do pedido #${order.number}:`, error?.message || error);
        return {printed: false, error: String(error?.message || error)};
    }
}
