import {
    renderHeaderRaw, renderItemTicketRaw, renderTotalTicketRaw, renderFooterRaw, initPrinter, renderSessionRaw,
    renderTestRaw,
} from './receiptRenderer.js';
import {EscposStrategy} from "./escposStrategy.js";
import {openCashDrawer} from "./printCommands.js";

const escpos = new EscposStrategy();

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

export async function printTicketRequest({printerName, headers, items, totalAmount, printType, openDrawer, isTest}) {
    const totalEuros = toEuros(totalAmount);
    const expanded = expandItems(items);

    const jobPrefix = 'POS';

    let buf = Buffer.concat([initPrinter()]);

    if (openDrawer) {
        buf = Buffer.concat([buf, openCashDrawer()]);
    }

    if (isTest) {
        await escpos.getPrinterDetails(printerName).then(async printerDetails => {
            const buf = Buffer.concat([
                renderTestRaw(headers, printType, openDrawer, printerDetails),
                renderHeaderRaw(headers),
            ]);

            await escpos.printRawByName(printerName, buf, `${jobPrefix} Test Print`);
        });
        return;
    }

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

    await escpos.printRawByName(printerName, buf, `${jobPrefix} Job`);
}

export async function printSessionRequest({printerName, headers, sessionData, openDrawer}) {
    const jobPrefix = 'POS';

    let buf = Buffer.concat([
        initPrinter(),
        renderSessionRaw(sessionData),
        renderHeaderRaw(headers),
    ]);

    if (openDrawer) {
        buf = Buffer.concat([openCashDrawer(), buf]);
    }
    await escpos.printRawByName(printerName, buf, `${jobPrefix} Session Summary`);
}

export async function listPrinters() {
    return await escpos.listPrinters();
}