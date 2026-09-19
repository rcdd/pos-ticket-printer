import {printOrderTicket, printOrderVoid, printOrderMove} from './printing/printService.js';
import {
    getPrinterVariable, getHeadersVariable, getPrintProfileVariable, readOrderSplitSetting,
} from '../db/controllers/options.controller.js';
import db from '../db/index.js';
import {groupItemsByZone} from './printing/zoneSplit.js';

// Printing is best-effort: the order is already saved by the time this runs.
// A printer failure returns {printed:false, error} and the terminal offers
// "Reimprimir" — an order is never lost because of paper.

const activeItems = (order) =>
    (order.items ?? []).filter((item) => item.status !== 'cancelled');

// zone name per productId, one query (order items only carry productId)
const zoneNamesByProductId = async (items) => {
    const ids = [...new Set(items.map((it) => it.productId).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const products = await db.products.findAll({
        where: {id: ids},
        include: [{model: db.zones, as: 'zone', attributes: ['name']}],
    });
    return new Map(products.map((p) => [p.id, p.zone?.name?.trim() || null]));
};

// One group per zone when splitting is on; a single unlabelled group otherwise.
const ticketGroups = async (items) => {
    if (!(await readOrderSplitSetting())) {
        return [{zoneLabel: null, items}];
    }
    return groupItemsByZone(items, await zoneNamesByProductId(items));
};

export async function tryPrintOrderTicket(order, {reprint = false} = {}) {
    try {
        const printerName = await getPrinterVariable();
        if (!printerName) {
            return {printed: false, error: 'Impressora não configurada.'};
        }

        const headers = await getHeadersVariable();
        const profile = await getPrintProfileVariable();
        for (const group of await ticketGroups(activeItems(order))) {
            await printOrderTicket({
                printerName,
                headers,
                profile,
                number: order.number,
                tableNumber: order.table ? (order.table.displayName || order.table.number) : null,
                items: group.items,
                zoneLabel: group.zoneLabel,
                note: order.note,
                waiterName: order.user?.name || order.user?.username || null,
                createdAt: order.createdAt,
                reprint,
            });
        }
        return {printed: true, error: null};
    } catch (error) {
        console.error(`[print] Falha a imprimir pedido #${order.number}:`, error?.message || error);
        return {printed: false, error: String(error?.message || error)};
    }
}

// Correction ticket after a table move — the kitchen's original ticket says
// the OLD table, so without this the food still goes to the wrong place.
export async function tryPrintOrderMove(order, fromLabel, toLabel, movedByName) {
    try {
        const printerName = await getPrinterVariable();
        if (!printerName) {
            return {printed: false, error: 'Impressora não configurada.'};
        }
        await printOrderMove({
            printerName,
            headers: await getHeadersVariable(),
            profile: await getPrintProfileVariable(),
            number: order.number,
            fromLabel,
            toLabel,
            movedByName,
        });
        return {printed: true, error: null};
    } catch (error) {
        console.error(`[print] Falha a imprimir correção do pedido #${order.number}:`, error?.message || error);
        return {printed: false, error: String(error?.message || error)};
    }
}

export async function tryPrintOrderVoid(order, cancelledItems, approvedByName) {
    try {
        const printerName = await getPrinterVariable();
        if (!printerName) {
            return {printed: false, error: 'Impressora não configurada.'};
        }

        const headers = await getHeadersVariable();
        const profile = await getPrintProfileVariable();
        for (const group of await ticketGroups(cancelledItems)) {
            await printOrderVoid({
                printerName,
                headers,
                profile,
                number: order.number,
                tableNumber: order.table ? (order.table.displayName || order.table.number) : null,
                items: group.items,
                zoneLabel: group.zoneLabel,
                approvedByName,
                cancelledAt: new Date(),
            });
        }
        return {printed: true, error: null};
    } catch (error) {
        console.error(`[print] Falha a imprimir anulação do pedido #${order.number}:`, error?.message || error);
        return {printed: false, error: String(error?.message || error)};
    }
}
