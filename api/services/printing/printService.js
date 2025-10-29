import {
    renderHeaderRaw, renderItemTicketRaw, renderTotalTicketRaw, renderFooterRaw, initPrinter, renderSessionRaw,
    renderTestRaw,
} from './receiptRenderer.js';
import {EscposStrategy} from "./escposStrategy.js";
import {openCashDrawer} from "./printCommands.js";
import directPrintStrategy from "./directPrintStrategy.js";

const escpos = new EscposStrategy();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const INTER_JOB_DELAY_MS = Number(process.env.PRINT_INTER_JOB_DELAY_MS || 30);

function toEuros(n) {
    if (typeof n === 'string') return Number(n.replace(',', '.')) || 0;
    if (Number.isInteger(n) && Math.abs(n) > 100) return n / 100;
    return Number(n) || 0;
}

function expandItems(items = []) {
    const lines = [];
    for (const it of items) {
        const qty = Math.max(1, Number(it?.quantity || 1));
        const type = String(it?.type || '').toLowerCase();
        if (type === 'menu' && Array.isArray(it?.products)) {
            for (let i = 0; i < qty; i++) {
                for (const p of it.products) {
                    lines.push({name: String(p?.name || '').trim()});
                }
            }
        } else {
            for (let i = 0; i < qty; i++) {
                lines.push({name: String(it?.name || '').trim()});
            }
        }
    }
    return lines;
}

export async function printTicketRequest({printerName, headers, items, totalAmount, printType, openDrawer, isTest, printMethod, directPrintConfig}) {
    const totalEuros = toEuros(totalAmount);
    const expanded = expandItems(items);

    const jobPrefix = 'POS';

    // Determine print method: 'direct' or 'shared' (default)
    const method = printMethod && printMethod.toLowerCase() === 'direct' ? 'direct' : 'shared';

    if (isTest) {
        await escpos.getPrinterDetails(printerName).then(async printerDetails => {
            const buf = Buffer.concat([
                renderTestRaw(headers, printType, openDrawer, printerDetails),
                renderHeaderRaw(headers),
            ]);

            // Print using selected method
            if (method === 'direct' && directPrintConfig) {
                await directPrintStrategy.printRaw(directPrintConfig, buf, `${jobPrefix} Test Print`);
            } else {
                await escpos.printRawByName(printerName, buf, `${jobPrefix} Test Print`);
            }
        });
        return;
    }

    if (openDrawer) {
        const buf = Buffer.concat([initPrinter(), openCashDrawer(),]);

        // Print using selected method
        if (method === 'direct' && directPrintConfig) {
            await directPrintStrategy.printRaw(directPrintConfig, buf, `${jobPrefix} Open Drawer`);
        } else {
            await escpos.printRawByName(printerName, buf, `${jobPrefix} Open Drawer`);
        }
    }

    let buf = Buffer.concat([initPrinter(),]);
    if (printType === 'tickets' || printType === 'both') {
        for (const line of expanded) {
            buf = Buffer.concat([
                buf,
                renderItemTicketRaw(line.name || ''),
                renderFooterRaw(headers),
                renderHeaderRaw(headers)]);
        }
    }

    if (printType === 'totals' || printType === 'both') {
        buf = Buffer.concat([
            buf,
            renderTotalTicketRaw(items, totalEuros),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);
    }

    // Print using selected method
    if (method === 'direct' && directPrintConfig) {
        await directPrintStrategy.printRaw(directPrintConfig, buf, `${jobPrefix} Job`);
    } else {
        await escpos.printRawByName(printerName, buf, `${jobPrefix} Job`);
    }
}

export async function printSessionRequest({printerName, headers, sessionData, printMethod, directPrintConfig}) {
    const jobPrefix = 'POS';

    // Determine print method: 'direct' or 'shared' (default)
    const method = printMethod && printMethod.toLowerCase() === 'direct' ? 'direct' : 'shared';

    const buf = Buffer.concat([
        initPrinter(),
        renderSessionRaw(sessionData),
        renderHeaderRaw(headers),
    ]);

    // Print using selected method
    if (method === 'direct' && directPrintConfig) {
        await directPrintStrategy.printRaw(directPrintConfig, buf, `${jobPrefix} Session Summary`);
    } else {
        await escpos.printRawByName(printerName, buf, `${jobPrefix} Session Summary`);
    }
}

export async function listPrinters() {
    return await escpos.listPrinters();
}

/**
 * List available USB/Serial devices for direct printing
 * @returns {Promise<string[]>}
 */
export async function listUSBDevices() {
    return await directPrintStrategy.listUSBDevices();
}

/**
 * Test direct printer connection
 * @param {object} config - Direct printer configuration
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testDirectConnection(config) {
    return await directPrintStrategy.testConnection(config);
}