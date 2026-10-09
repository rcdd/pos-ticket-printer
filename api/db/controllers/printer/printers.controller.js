import crypto from 'crypto';

import {
    readExtraPrinters, writeExtraPrinters, readZoneRoutes, writeZoneRoutes,
    readMultiPrinterEnabled, writeMultiPrinterEnabled,
} from '../../../services/printing/printerRegistry.js';
import {
    validateExtraPrinter, validateMainPrinter, resolveHeader, MAX_EXTRA_PRINTERS,
} from '../../../services/printing/printerConfig.js';
import {MAIN_PRINTER_ID} from '../../../services/printing/zoneSplit.js';
import {printOrderTicket} from '../../../services/printing/printService.js';
import {probeTcp, discoverNetworkPrinters} from '../../../services/printing/networkPrinter.js';
import {
    getHeadersVariable, getMainPrinterSettings, writeMainPrinterSettings, getMainPrinterTarget, getPrintProfileVariable,
} from '../options.controller.js';
import {printSampleTicket} from './printer.controller.js';

// Configurações → Impressoras: every printer (main + additional) is edited
// through the same dialog; plus zone routes and the multi-printer switch.
// The main printer keeps its historical options (see options.controller).

const configPayload = async () => {
    const printers = await readExtraPrinters();
    return {
        enabled: await readMultiPrinterEnabled(),
        main: {id: MAIN_PRINTER_ID, name: 'Principal', ...(await getMainPrinterSettings())},
        printers,
        routes: await readZoneRoutes(printers),
        maxPrinters: MAX_EXTRA_PRINTERS,
    };
};

const sendError = (res, label, error) => {
    console.error(`[printers.${label}] error:`, error);
    res.status(500).send({message: 'Não foi possível guardar a configuração das impressoras.'});
};

export const getConfig = async (req, res) => {
    try {
        res.send(await configPayload());
    } catch (error) {
        console.error('[printers.getConfig] error:', error);
        res.status(500).send({message: 'Não foi possível obter a configuração das impressoras.'});
    }
};

export const setEnabled = async (req, res) => {
    try {
        const enabled = req.body?.enabled;
        if (typeof enabled !== 'boolean') {
            return res.status(400).send({message: "O campo 'enabled' é obrigatório (verdadeiro/falso)."});
        }
        await writeMultiPrinterEnabled(enabled);
        res.send(await configPayload());
    } catch (error) {
        sendError(res, 'setEnabled', error);
    }
};

export const create = async (req, res) => {
    try {
        const printers = await readExtraPrinters();
        if (printers.length >= MAX_EXTRA_PRINTERS) {
            return res.status(400).send({message: `Máximo de ${MAX_EXTRA_PRINTERS} impressoras adicionais.`});
        }
        const {printer, error} = validateExtraPrinter(req.body, {id: `p${crypto.randomBytes(4).toString('hex')}`});
        if (error) return res.status(400).send({message: error});
        if (printers.some((p) => p.name.toLowerCase() === printer.name.toLowerCase())) {
            return res.status(400).send({message: 'Já existe uma impressora com esse nome.'});
        }
        await writeExtraPrinters([...printers, printer]);
        res.status(201).send(await configPayload());
    } catch (error) {
        sendError(res, 'create', error);
    }
};

export const update = async (req, res) => {
    try {
        const printers = await readExtraPrinters();
        const index = printers.findIndex((p) => p.id === req.params.id);
        if (index < 0) return res.status(404).send({message: 'Impressora não encontrada.'});
        const {printer, error} = validateExtraPrinter(req.body, {id: req.params.id});
        if (error) return res.status(400).send({message: error});
        if (printers.some((p) => p.id !== printer.id && p.name.toLowerCase() === printer.name.toLowerCase())) {
            return res.status(400).send({message: 'Já existe uma impressora com esse nome.'});
        }
        const next = [...printers];
        next[index] = printer;
        await writeExtraPrinters(next);
        res.send(await configPayload());
    } catch (error) {
        sendError(res, 'update', error);
    }
};

// Its zones go back to the main printer.
export const remove = async (req, res) => {
    try {
        const printers = await readExtraPrinters();
        const remaining = printers.filter((p) => p.id !== req.params.id);
        if (remaining.length === printers.length) {
            return res.status(404).send({message: 'Impressora não encontrada.'});
        }
        await writeExtraPrinters(remaining);
        await writeZoneRoutes(await readZoneRoutes(remaining));
        res.send(await configPayload());
    } catch (error) {
        sendError(res, 'remove', error);
    }
};

// body: {routes: {zoneId: printerId}} — 'main' (or no entry) = main printer
export const setRoutes = async (req, res) => {
    try {
        const incoming = req.body?.routes;
        if (!incoming || typeof incoming !== 'object') {
            return res.status(400).send({message: "O campo 'routes' é obrigatório."});
        }
        const printers = await readExtraPrinters();
        const ids = new Set(printers.map((p) => p.id));
        const routes = {};
        for (const [zoneId, printerId] of Object.entries(incoming)) {
            if (!Number.isInteger(Number(zoneId))) {
                return res.status(400).send({message: `Zona inválida: ${zoneId}.`});
            }
            if (printerId === MAIN_PRINTER_ID || printerId === null) continue;
            if (!ids.has(printerId)) {
                return res.status(400).send({message: 'Impressora de destino inexistente.'});
            }
            routes[Number(zoneId)] = printerId;
        }
        await writeZoneRoutes(routes);
        res.send(await configPayload());
    } catch (error) {
        sendError(res, 'setRoutes', error);
    }
};

export const updateMain = async (req, res) => {
    try {
        const {main, error} = validateMainPrinter(req.body);
        if (error) return res.status(400).send({message: error});
        await writeMainPrinterSettings(main);
        res.send(await configPayload());
    } catch (error) {
        sendError(res, 'updateMain', error);
    }
};

// "Imprimir exemplo" / "Testar gaveta" from the edit dialog: prints with the
// settings being edited (NOT saved yet), so they can be tuned before saving.
// body: {printerId, connection, profile, ticketType}
export const printDraftSample = async (req, res) => {
    try {
        const body = req.body ?? {};
        const isMain = body.printerId === MAIN_PRINTER_ID;
        const validated = isMain
            ? validateMainPrinter(body)
            : validateExtraPrinter({...body, name: body.name || 'Exemplo'});
        if (validated.error) return res.status(400).send({message: validated.error});
        const {connection, profile} = isMain ? validated.main : validated.printer;
        const mainHeaders = await getHeadersVariable();
        await printSampleTicket(body.ticketType, {
            // the main printer's OS name travels as a plain string (historical form)
            printerName: connection.type === 'system' ? connection.systemName : connection,
            headers: resolveHeader(isMain ? validated.main.header : validated.printer.header, mainHeaders),
            profile,
        });
        res.send({ok: true});
    } catch (error) {
        if (error.statusCode === 400) return res.status(400).send({message: error.message});
        console.error('[printers.printDraftSample] error:', error);
        res.status(502).send({message: 'A impressão falhou.', detail: String(error?.message || error)});
    }
};

// Sample order ticket on that printer, with ITS profile — validates the
// connection and the layout at once. No fallback: a failure is the answer.
export const testPrint = async (req, res) => {
    try {
        if (req.params.id === MAIN_PRINTER_ID) {
            const target = await getMainPrinterTarget();
            if (!target) return res.status(404).send({message: 'Impressora principal não configurada.'});
            await printSampleTicket('test', {
                printerName: target,
                headers: await getHeadersVariable(),
                profile: await getPrintProfileVariable(),
            });
            return res.send({ok: true});
        }
        const printer = (await readExtraPrinters()).find((p) => p.id === req.params.id);
        if (!printer) return res.status(404).send({message: 'Impressora não encontrada.'});
        await printOrderTicket({
            printerName: printer.connection,
            headers: resolveHeader(printer.header, await getHeadersVariable()),
            profile: printer.profile,
            number: 123,
            tableNumber: '12A',
            items: [
                {quantity: 2, nameSnapshot: 'Bifana'},
                {quantity: 1, nameSnapshot: 'Caldo verde'},
            ],
            zoneLabel: printer.name,
            note: 'Impressao de teste',
            waiterName: 'Exemplo',
        });
        res.send({ok: true});
    } catch (error) {
        console.error('[printers.testPrint] error:', error);
        res.status(502).send({message: 'A impressão de teste falhou.', detail: String(error?.message || error)});
    }
};

export const testConnection = async (req, res) => {
    const host = String(req.body?.host ?? '').trim();
    if (!host) return res.status(400).send({message: 'Indique o IP ou o nome da impressora.'});
    const ok = await probeTcp(host, req.body?.port);
    res.send({ok});
};

export const discover = async (req, res) => {
    try {
        res.send(await discoverNetworkPrinters({port: req.query.port}));
    } catch (error) {
        console.error('[printers.discover] error:', error);
        res.status(500).send({message: 'Não foi possível procurar impressoras na rede.'});
    }
};
