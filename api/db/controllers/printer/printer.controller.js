import db from '../../index.js';

const Option = db.options;

import {listPrinters, printTicketRequest, printSessionRequest, listUSBDevices, testDirectConnection as testDirectConnectionService} from '../../../services/printing/printService.js';

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
        let printerName = req.body.printer;
        const headers = req.body.headers;
        const printMethod = req.body.printMethod || 'shared';
        const directPrintConfig = req.body.directPrintConfig;

        const items = req.body.items || [];
        const totalAmount = req.body.totalAmount ?? '0';
        const printType = req.body.printType || 'totals';
        const openDrawer = req.body.openDrawer || false;
        const isTest = req.body.test || false;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }

        // For shared printing, require printer name
        if (printMethod !== 'direct' && !printerName) {
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
            printMethod,
            directPrintConfig
        });

        res.send('OK');
    } catch (err) {
        console.error('[printTicketRequest] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

export const printSessionSummary = async (req, res) => {
    try {
        let printerName = req.body.printer;
        const headers = req.body.headers;
        const printMethod = req.body.printMethod || 'shared';
        const directPrintConfig = req.body.directPrintConfig;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }

        // For shared printing, require printer name
        if (printMethod !== 'direct' && !printerName) {
            return res.status(404).send('Printer not defined');
        }

        delete req.body.printer;
        delete req.body.headers;
        delete req.body.printMethod;
        delete req.body.directPrintConfig;

        await printSessionRequest({
            printerName,
            headers,
            sessionData: req.body,
            printMethod,
            directPrintConfig
        });
        res.send('OK');
    } catch (err) {
        console.error('[printSessionSummary] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

export const getUSBDeviceList = async (req, res) => {
    try {
        const devices = await listUSBDevices();
        res.json(devices);
    } catch (err) {
        console.error('[getUSBDeviceList] erro:', err);
        res.status(500).send({message: 'Erro ao listar dispositivos USB'});
    }
};

export const testDirectConnection = async (req, res) => {
    try {
        const config = req.body.config;

        if (!config) {
            return res.status(400).send({message: 'Configuration is required'});
        }

        const result = await testDirectConnectionService(config);
        res.json(result);
    } catch (err) {
        console.error('[testDirectConnection] erro:', err);
        res.status(500).send({message: 'Erro ao testar conexão', detail: String(err?.message || err)});
    }
};
