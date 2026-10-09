import db from '../../index.js';

const Option = db.options;

import {
    listPrinters, printTicketRequest, printSessionRequest, kickDrawer, printOrderTicket, printPickupTicket,
} from '../../../services/printing/printService.js';
import {getPrintProfileVariable, getHeadersVariable, readOrderSplitSetting, getMainPrinterTarget} from '../options.controller.js';
import {paymentsByMethod} from '../../../services/payments.util.js';
import {loadPrintSetup} from '../../../services/printing/printerRegistry.js';
import {planPrintGroups, MAIN_PRINTER_ID} from '../../../services/printing/zoneSplit.js';
import {zonesByProductId, printRoutedOrderTickets} from '../../../services/orderPrinting.service.js';
import {createOrderWithNumber, getActiveSession} from '../orders.controller.js';
import {OrderStatus} from '../../models/order.model.js';

// main printer target: OS printer name or a LAN target object
export const getPrintName = async () => {
    const target = await getMainPrinterTarget();
    if (!target) throw new Error('Printer not found !!');
    return target;
};

export const getPrinterList = async (req, res) => {
    try {
        const list = await listPrinters();
        const simpleList = [];
        for (const p of list) {
            if (typeof p === 'string') {
                simpleList.push({name: p, systemName: p});
            } else if (p && typeof p === 'object' && p.name) {
                simpleList.push({name: p.name, systemName: p.systemName});
            }
        }
        res.json(simpleList);
    } catch (err) {
        console.error('[getPrinterList] error:', err);
        res.status(500).send({message: 'Erro ao listar impressoras'});
    }
};

export const printTicket = async (req, res) => {
    try {
        let printerName = req.body.printer;
        const headers = req.body.headers;

        const items = req.body.items || [];
        const totalAmount = req.body.totalAmount ?? '0';
        const printType = req.body.printType || 'totals';
        const openDrawer = req.body.openDrawer || false;
        const isTest = req.body.test || false;
        // optional title for the totals block (e.g. "Conta - Mesa 2A" on
        // payment receipts); direct sales keep the usual "Pedido:"
        const receiptTitle = typeof req.body.receiptTitle === 'string'
            ? req.body.receiptTitle.slice(0, 32)
            : undefined;
        // split payments breakdown printed under the total (data only — the
        // invoice itself was already validated/recorded by the invoice API)
        const payments = Array.isArray(req.body.payments)
            ? paymentsByMethod(req.body.payments
                .filter((p) => p && typeof p.method === 'string' && Number.isFinite(Number(p.amount)))
                .map((p) => ({method: p.method, amount: Number(p.amount)})))
            : undefined;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }
        if (!printerName) {
            return res.status(404).send('Printer not defined');
        }

        const routing = req.body.directSale && !isTest
            ? await planDirectSaleRouting(items)
            : null;

        if (!routing) {
            await printTicketRequest({
                printerName,
                headers,
                items,
                totalAmount,
                printType,
                openDrawer,
                isTest,
                receiptTitle,
                payments,
                profile: await getPrintProfileVariable()
            });
            return res.send({ok: true, pickup: null, warnings: []});
        }

        // Direct sale with items prepared at another printer (option "A"):
        // the order gets a number shared with the terminal orders, the
        // register prints the local tickets + receipt + the customer's pickup
        // ticket, and the other printer(s) get the order ticket.
        const order = await createOrderWithNumber({
            sessionId: routing.session.id,
            tableId: null,
            userId: req.user?.id ?? null,
            note: null,
            clientRequestId: null,
            items: routing.orderItems,
            status: OrderStatus.PAID,
        });

        try {
            await printTicketRequest({
                printerName,
                headers,
                items,
                ticketLines: routing.localLines,
                totalAmount,
                printType,
                openDrawer,
                isTest: false,
                receiptTitle,
                payments,
                profile: routing.setup.main.profile,
            });
            await printPickupTicket({
                printerName,
                headers,
                profile: routing.setup.main.profile,
                number: order.number,
                items: routing.routedGroups.flatMap((g) => g.items),
                zoneLabel: routing.destinations.join(' / ') || null,
            });
        } catch (error) {
            // nothing reached the customer: the sale is not concluded (the
            // register retries), so this number must not stay as a real order
            await order.update({status: OrderStatus.CANCELLED}).catch(() => {});
            throw error;
        }

        // the customer already has the receipt: from here on a failure is a
        // warning (the cashier must tell the kitchen), never a failed sale
        let warnings;
        try {
            warnings = await printRoutedOrderTickets(routing.setup, order, routing.routedGroups);
            await order.update({printedAt: new Date()}).catch(() => {});
        } catch (error) {
            warnings = [`O pedido ${String(order.number).padStart(3, '0')} não foi impresso no destino: ${error?.message || error}`];
        }

        res.send({
            ok: true,
            pickup: {number: order.number, destinations: routing.destinations},
            warnings,
        });
    } catch (err) {
        console.error('[printTicketRequest] error:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

// Cart (direct sale) → printable lines with their productId: products as
// they are, menus expanded into their component products.
const cartLines = (items) => {
    const lines = [];
    for (const it of items) {
        const quantity = Math.max(1, Number(it?.quantity || 1));
        const isMenu = String(it?.type || '').toLowerCase() === 'menu' && Array.isArray(it?.products);
        if (isMenu) {
            for (const p of it.products) {
                lines.push({productId: Number(p?.id) || null, name: String(p?.name || '').trim(), quantity, price: 0});
            }
        } else {
            lines.push({
                productId: Number(it?.id) || null,
                name: String(it?.name || '').trim(),
                quantity,
                price: Math.max(0, Math.round(Number(it?.price) || 0)),
            });
        }
    }
    return lines;
};

// null when nothing in the cart goes to another printer (or the multi-printer
// mode is off) — then the sale prints exactly as it always did.
const planDirectSaleRouting = async (items) => {
    const setup = await loadPrintSetup();
    if (!setup.enabled || Object.keys(setup.routes).length === 0) return null;

    const lines = cartLines(items);
    const plan = planPrintGroups(
        lines,
        await zonesByProductId(lines.map((l) => l.productId)),
        {routes: setup.routes, split: await readOrderSplitSetting()},
    );
    const routedGroups = plan.filter((g) => g.printerId !== MAIN_PRINTER_ID);
    if (routedGroups.length === 0) return null;

    const session = await getActiveSession();
    if (!session) return null; // no session: no numbering — print as before

    const localLines = [];
    for (const group of plan.filter((g) => g.printerId === MAIN_PRINTER_ID)) {
        for (const line of group.items) {
            for (let i = 0; i < line.quantity; i++) localLines.push({name: line.name});
        }
    }

    return {
        setup,
        session,
        routedGroups,
        localLines,
        destinations: [...new Set(routedGroups
            .map((g) => g.zoneLabel ?? setup.printers.get(g.printerId)?.name)
            .filter(Boolean))],
        orderItems: routedGroups.flatMap((g) => g.items).map((line) => ({
            productId: line.productId,
            nameSnapshot: line.name || '?',
            quantity: line.quantity,
            price: line.price,
        })),
    };
};

// "Testar gaveta": envia apenas o comando de abertura, sem imprimir nada
export const testDrawer = async (req, res) => {
    try {
        const printerName = await getPrintName().catch(() => null);
        if (!printerName) {
            return res.status(404).send({message: 'Impressora não definida.'});
        }
        await kickDrawer({printerName, profile: await getPrintProfileVariable()});
        res.send('OK');
    } catch (err) {
        console.error('[testDrawer] error:', err);
        res.status(500).send({message: 'Não foi possível abrir a gaveta.', detail: String(err?.message || err)});
    }
};

// One sample of a ticket type with the given target/profile, using fixed
// sample data — lets the user tune text sizes on-site without creating real
// orders. Throws on an unknown type (statusCode 400).
export const printSampleTicket = async (ticketType, {printerName, headers, profile}) => {
    const sampleItems = [
        {name: 'Imperial', quantity: 2},
        {name: 'Bifana', quantity: 1},
    ];

    if (ticketType === 'item') {
        await printTicketRequest({
            printerName, headers, profile,
            items: [{name: 'Produto Exemplo', quantity: 1}],
            totalAmount: 0, printType: 'tickets', openDrawer: false,
        });
    } else if (ticketType === 'totals') {
        await printTicketRequest({
            printerName, headers, profile,
            items: sampleItems, totalAmount: 5.9,
            printType: 'totals', openDrawer: false,
        });
    } else if (ticketType === 'order') {
        await printOrderTicket({
            printerName, headers, profile,
            number: 123, tableNumber: '12A',
            items: sampleItems.map((it) => ({quantity: it.quantity, nameSnapshot: it.name})),
            zoneLabel: 'Cozinha',
            note: 'Sem picante',
            waiterName: 'Exemplo',
        });
    } else if (ticketType === 'session') {
        const now = new Date().toISOString();
        await printSessionRequest({
            printerName, headers, profile, openDrawer: false,
            sessionData: {
                sessionId: 0, openedAt: now, closedAt: now,
                userOpen: 'Exemplo', userClose: 'Exemplo',
                products: sampleItems.map((it) => ({...it, total: it.quantity * 150})),
                discountedProducts: [], payments: [{method: 'cash', amount: 450}],
                cashMovements: [], totalSales: 2,
                initialAmount: 5000, finalCashValue: 5450, closingAmount: 450,
            },
        });
    } else if (ticketType === 'test') {
        await printTicketRequest({
            printerName, headers, profile,
            items: [], totalAmount: 0, printType: 'totals', openDrawer: false, isTest: true,
        });
    } else if (ticketType === 'drawer') {
        await kickDrawer({printerName, profile});
    } else {
        const error = new Error('Tipo de talão inválido.');
        error.statusCode = 400;
        throw error;
    }
};

// "Imprimir exemplo" with the SAVED main printer settings
export const printLayoutSample = async (req, res) => {
    try {
        const printerName = await getPrintName().catch(() => null);
        if (!printerName) {
            return res.status(404).send({message: 'Impressora não definida.'});
        }
        await printSampleTicket(req.body?.ticketType, {
            printerName,
            headers: await getHeadersVariable(),
            profile: await getPrintProfileVariable(),
        });
        res.send('OK');
    } catch (err) {
        if (err.statusCode === 400) return res.status(400).send({message: err.message});
        console.error('[printLayoutSample] error:', err);
        res.status(500).send({message: 'Erro a imprimir o exemplo.', detail: String(err?.message || err)});
    }
};

export const printSessionSummary = async (req, res) => {
    try {
        let printerName = req.body.printer;
        const headers = req.body.headers;
        const openDrawer = req.body.openDrawer || false;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }
        if (!printerName) {
            return res.status(404).send('Printer not defined');
        }

        delete req.body.printer;
        delete req.body.headers;

        await printSessionRequest({
            printerName,
            headers,
            sessionData: req.body,
            openDrawer,
            profile: await getPrintProfileVariable()
        });
        res.send('OK');
    } catch (err) {
        console.error('[printSessionSummary] error:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
}
