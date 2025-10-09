import db from '../../index.js';

const Option = db.options;

import {listPrinters, printTicketRequest, printSessionRequest} from '../../../services/printing/printService.js';

let PRINTER_NAME = 'undefined';
let HEADERS = {firstLine: 'Undefined', secondLine: 'Undefined'};

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
        console.error('[getPrinterList] erro:', err);
        res.status(500).send({message: 'Erro ao listar impressoras'});
    }
};

export const printTicket = async (req, res) => {
    try {
        PRINTER_NAME = req.body.printer;
        HEADERS = req.body.headers;

        const items = req.body.items || [];
        const totalAmount = req.body.totalAmount ?? '0';
        const printType = req.body.printType || 'totals';
        const openDrawer = req.body.openDrawer || false;
        const isTest = req.body.test || false;

        if (!PRINTER_NAME || PRINTER_NAME === 'undefined') {
            try {
                PRINTER_NAME = await getPrintName();
            } catch {
            }
        }
        if (!PRINTER_NAME) {
            return res.status(404).send('Printer not defined');
        }

        await printTicketRequest({
            printerName: PRINTER_NAME,
            headers: HEADERS,
            items,
            totalAmount,
            printType,
            openDrawer,
            isTest
        });

        res.send('OK');
    } catch (err) {
        console.error('[printTicketRequest] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

export const printSessionSummary = async (req, res) => {
    try {
        PRINTER_NAME = req.body.printer;
        HEADERS = req.body.headers;

        if (!PRINTER_NAME || PRINTER_NAME === 'undefined') {
            try {
                PRINTER_NAME = await getPrintName();
            } catch {
            }
        }
        if (!PRINTER_NAME) {
            return res.status(404).send('Printer not defined');
        }

        delete req.body.printer;
        delete req.body.headers;

        await printSessionRequest({
            printerName: PRINTER_NAME,
            headers: HEADERS,
            sessionData: req.body
        });
        res.send('OK');
    } catch (err) {
        console.error('[printSessionSummary] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
}
