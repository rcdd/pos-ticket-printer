import db from '../../index.js';

const Option = db.options;

import {
    listPrinters, printTicketRequest, printSessionRequest, kickDrawer, printOrderTicket,
} from '../../../services/printing/printService.js';
import {getPrintProfileVariable, getHeadersVariable} from '../options.controller.js';

export const getPrintName = async () => {
    const opt = await Option.findOne({where: {name: 'printer'}});
    if (!opt || !opt.value) throw new Error('Printer not found !!');
    return opt.value;
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

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }
        if (!printerName) {
            return res.status(404).send('Printer not defined');
        }

        await printTicketRequest({
            printerName,
            headers,
            items,
            totalAmount,
            printType,
            openDrawer,
            isTest,
            receiptTitle,
            profile: await getPrintProfileVariable()
        });

        res.send('OK');
    } catch (err) {
        console.error('[printTicketRequest] error:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
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

// "Imprimir exemplo" of the ticket layout settings: prints one sample of the
// requested ticket type with the CURRENT profile + layout, using fixed sample
// data — lets the user tune text sizes on-site without creating real orders.
export const printLayoutSample = async (req, res) => {
    try {
        const ticketType = req.body?.ticketType;
        const printerName = await getPrintName().catch(() => null);
        if (!printerName) {
            return res.status(404).send({message: 'Impressora não definida.'});
        }
        const headers = await getHeadersVariable();
        const profile = await getPrintProfileVariable();
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
        } else {
            return res.status(400).send({message: 'Tipo de talão inválido.'});
        }
        res.send('OK');
    } catch (err) {
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
