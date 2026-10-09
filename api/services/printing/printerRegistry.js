import db from '../../db/index.js';
import {getMainPrinterTarget, getPrintProfileVariable, getHeadersVariable} from '../../db/controllers/options.controller.js';
import {normalizeExtraPrinters, normalizeRoutes, resolveHeader} from './printerConfig.js';
import {MAIN_PRINTER_ID} from './zoneSplit.js';

// Where every printer's config lives (options table):
// - main printer: the historical options ('printer', printer_* profile,
//   printer_ticket_layout) — untouched, so single-printer installs see no change;
// - additional printers: JSON list in 'printers_extra';
// - zone → printer routes: JSON in 'printer_zone_routes';
// - master switch 'multi_printer_enabled' (default off). Turning it off sends
//   everything to the main printer again but KEEPS the extra printers and the
//   routes, so switching between setups is a single click.
const optionExtraPrinters = 'printers_extra';
const optionZoneRoutes = 'printer_zone_routes';
const optionMultiPrinter = 'multi_printer_enabled';

const Option = db.options;

const readJson = async (name, fallback) => {
    const row = await Option.findOne({where: {name}});
    if (!row?.value) return fallback;
    try {
        return JSON.parse(row.value) ?? fallback;
    } catch {
        return fallback;
    }
};

const writeValue = async (name, value) => {
    const existing = await Option.findOne({where: {name}});
    if (existing) {
        await existing.update({value});
    } else {
        await Option.create({name, value});
    }
};

export const readExtraPrinters = async () => normalizeExtraPrinters(await readJson(optionExtraPrinters, []));

export const writeExtraPrinters = async (printers) => {
    await writeValue(optionExtraPrinters, JSON.stringify(printers));
};

export const readMultiPrinterEnabled = async () => {
    const row = await Option.findOne({where: {name: optionMultiPrinter}});
    return String(row?.value ?? 'false').toLowerCase() === 'true';
};

export const writeMultiPrinterEnabled = async (enabled) => {
    await writeValue(optionMultiPrinter, enabled ? 'true' : 'false');
};

export const readZoneRoutes = async (printers = null) => {
    const list = printers ?? await readExtraPrinters();
    return normalizeRoutes(await readJson(optionZoneRoutes, {}), list.map((p) => p.id));
};

export const writeZoneRoutes = async (routes) => {
    await writeValue(optionZoneRoutes, JSON.stringify(routes));
};

// Everything a print run needs, read once: the printers by id (main
// included, possibly without a configured device — each with the header
// lines it prints) and the routes that are
// ACTIVE right now (empty when the master switch is off).
export async function loadPrintSetup() {
    const [mainName, mainProfile, enabled, extras, mainHeaders] = await Promise.all([
        getMainPrinterTarget(),
        getPrintProfileVariable(),
        readMultiPrinterEnabled(),
        readExtraPrinters(),
        getHeadersVariable(),
    ]);

    const printers = new Map();
    printers.set(MAIN_PRINTER_ID, {
        id: MAIN_PRINTER_ID,
        name: 'Principal',
        target: mainName || null,
        profile: mainProfile,
        headers: mainHeaders,
        isMain: true,
    });
    for (const extra of extras) {
        printers.set(extra.id, {
            id: extra.id,
            name: extra.name,
            target: extra.connection,
            profile: extra.profile,
            headers: resolveHeader(extra.header, mainHeaders),
            isMain: false,
        });
    }

    return {
        enabled,
        printers,
        routes: enabled ? await readZoneRoutes(extras) : {},
        main: printers.get(MAIN_PRINTER_ID),
    };
}

// Prints on the given printer; if an ADDITIONAL printer fails (off, no
// paper, Wi-Fi down), the same content is rebuilt with the main printer's
// profile and printed there with a "printer X failed" notice — a kitchen
// order is never silently lost. printFn({printer, fallbackFrom}) does the
// actual printing. Returns {printerId, fallback, error}.
export async function printWithFallback(setup, printerId, printFn) {
    const printer = setup.printers.get(printerId) ?? setup.main;
    if (printer.isMain) {
        if (!printer.target) throw new Error('Impressora não configurada.');
        await printFn({printer, fallbackFrom: null});
        return {printerId: printer.id, fallback: false, error: null};
    }
    try {
        await printFn({printer, fallbackFrom: null});
        return {printerId: printer.id, fallback: false, error: null};
    } catch (error) {
        const message = String(error?.message || error);
        console.error(`[print] Impressora "${printer.name}" falhou, a imprimir na Principal:`, message);
        if (!setup.main.target) {
            throw new Error(`Impressora "${printer.name}" falhou (${message}) e a Principal não está configurada.`);
        }
        try {
            await printFn({printer: setup.main, fallbackFrom: printer.name});
        } catch (fallbackError) {
            throw new Error(`Impressora "${printer.name}" falhou (${message}) e a Principal também (${fallbackError?.message || fallbackError}).`);
        }
        return {printerId: setup.main.id, fallback: true, error: `Impressora "${printer.name}" falhou: ${message}`};
    }
}
