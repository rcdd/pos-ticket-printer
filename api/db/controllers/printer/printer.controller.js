import db from '../../index.js';

const Option = db.options;

import {listPrinters, printTicketRequest, printSessionRequest, kickDrawer} from '../../../services/printing/printService.js';
import {getPrintProfileVariable} from '../options.controller.js';

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
