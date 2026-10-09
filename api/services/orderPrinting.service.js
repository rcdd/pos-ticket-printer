import {printOrderTicket, printOrderVoid, printOrderMove} from './printing/printService.js';
import {readOrderSplitSetting} from '../db/controllers/options.controller.js';
import db from '../db/index.js';
import {planPrintGroups, MAIN_PRINTER_ID} from './printing/zoneSplit.js';
import {loadPrintSetup, printWithFallback} from './printing/printerRegistry.js';

// Printing is best-effort: the order is already saved by the time this runs.
// A printer failure returns {printed:false, error} and the terminal offers
// "Reimprimir" — an order is never lost because of paper.
//
// With several printers (Configurações → Várias impressoras), each zone's
// items go to that zone's printer; an additional printer that fails falls
// back to the main one (see printWithFallback).

const activeItems = (order) =>
    (order.items ?? []).filter((item) => item.status !== 'cancelled');

// zone {id, name} per productId, one query (order items only carry productId)
export const zonesByProductId = async (productIds) => {
    const ids = [...new Set(productIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const products = await db.products.findAll({
        where: {id: ids},
        include: [{model: db.zones, as: 'zone', attributes: ['id', 'name']}],
    });
    return new Map(products.map((p) => [
        p.id,
        p.zone ? {id: p.zone.id, name: p.zone.name?.trim() || null} : null,
    ]));
};

const planFor = async (setup, items) => planPrintGroups(
    items,
    await zonesByProductId(items.map((it) => it.productId)),
    {routes: setup.routes, split: await readOrderSplitSetting()},
);

// Prints every group on its printer; collects fallback warnings. Throws only
// when a ticket could not be printed anywhere. printGroup gets the printer
// the ticket actually lands on — use ITS target, profile and header (after a
// fallback, the main printer's).
const printGroups = async (setup, groups, printGroup) => {
    const warnings = [];
    for (const group of groups) {
        const result = await printWithFallback(setup, group.printerId, ({printer, fallbackFrom}) =>
            printGroup(group, printer, fallbackFrom));
        if (result.error) warnings.push(result.error);
    }
    return warnings;
};

const tableLabel = (order) => (order.table ? (order.table.displayName || order.table.number) : null);

const failure = (label, order, error) => {
    console.error(`[print] Falha a imprimir ${label} #${order.number}:`, error?.message || error);
    return {printed: false, error: String(error?.message || error)};
};

export async function tryPrintOrderTicket(order, {reprint = false} = {}) {
    try {
        const setup = await loadPrintSetup();
        const groups = await planFor(setup, activeItems(order));
        const warnings = await printGroups(setup, groups, (group, printer, fallbackFrom) => printOrderTicket({
            printerName: printer.target,
            headers: printer.headers,
            profile: printer.profile,
            number: order.number,
            tableNumber: tableLabel(order),
            items: group.items,
            zoneLabel: group.zoneLabel,
            note: order.note,
            waiterName: order.user?.name || order.user?.username || null,
            createdAt: order.createdAt,
            reprint,
            fallbackFrom,
        }));
        return {printed: true, error: warnings.length ? warnings.join(' ') : null};
    } catch (error) {
        return failure('pedido', order, error);
    }
}

// Correction ticket after a table move — the kitchen's original ticket says
// the OLD table, so without this the food still goes to the wrong place.
// Goes to every printer that received part of the order.
export async function tryPrintOrderMove(order, fromLabel, toLabel, movedByName) {
    try {
        const setup = await loadPrintSetup();
        const groups = await planFor(setup, activeItems(order));
        const printerIds = [...new Set(groups.map((g) => g.printerId))];
        if (printerIds.length === 0) printerIds.push(MAIN_PRINTER_ID);
        const warnings = await printGroups(setup, printerIds.map((printerId) => ({printerId})), (group, printer, fallbackFrom) => printOrderMove({
            printerName: printer.target,
            headers: printer.headers,
            profile: printer.profile,
            number: order.number,
            fromLabel,
            toLabel,
            movedByName,
            fallbackFrom,
        }));
        return {printed: true, error: warnings.length ? warnings.join(' ') : null};
    } catch (error) {
        return failure('correção do pedido', order, error);
    }
}

export async function tryPrintOrderVoid(order, cancelledItems, approvedByName) {
    try {
        const setup = await loadPrintSetup();
        const groups = await planFor(setup, cancelledItems);
        const warnings = await printGroups(setup, groups, (group, printer, fallbackFrom) => printOrderVoid({
            printerName: printer.target,
            headers: printer.headers,
            profile: printer.profile,
            number: order.number,
            tableNumber: tableLabel(order),
            items: group.items,
            zoneLabel: group.zoneLabel,
            approvedByName,
            cancelledAt: new Date(),
            fallbackFrom,
        }));
        return {printed: true, error: warnings.length ? warnings.join(' ') : null};
    } catch (error) {
        return failure('anulação do pedido', order, error);
    }
}

// Direct sale at the register with items routed to another printer: that
// printer gets a regular order ticket (PEDIDO #N, BALCAO/AVULSO); the
// customer's pickup ticket with the same number is printed on the main
// printer by the caller. `order` is the paid order record created for the
// numbering; `groups` are the routed (non-main) groups from planPrintGroups.
export async function printRoutedOrderTickets(setup, order, groups) {
    return printGroups(setup, groups, (group, printer, fallbackFrom) => printOrderTicket({
        printerName: printer.target,
        headers: printer.headers,
        profile: printer.profile,
        number: order.number,
        tableNumber: null,
        items: group.items,
        zoneLabel: group.zoneLabel ?? setup.printers.get(group.printerId)?.name ?? null,
        note: null,
        waiterName: null,
        fallbackFrom,
    }));
}
