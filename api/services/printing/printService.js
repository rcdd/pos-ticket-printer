const {
    renderHeaderRaw, renderItemTicketRaw, renderTotalTicketRaw, escCut, renderFooterRaw, initPrinter, renderSessionRaw,
    renderTestRaw,
} = require('./receiptRenderer');
const {EscposStrategy} = require("./escposStrategy");
const {openCashDrawer, textPrintLine, newLine, align, horizontalLine} = require("./printCommands");

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

async function printTicketRequest({printerName, headers, items, totalAmount, printType, openDrawer, isTest}) {
    const totalEuros = toEuros(totalAmount);
    const expanded = expandItems(items);

    const jobPrefix = 'POS';

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

    if (openDrawer) {
        const buf = Buffer.concat([initPrinter(), openCashDrawer(),]);
        await escpos.printRawByName(printerName, buf, `${jobPrefix} Open Drawer`);
    }

    if (printType === 'tickets' || printType === 'both') {
        for (const line of expanded) {
            const buf = Buffer.concat([
                initPrinter(),
                renderItemTicketRaw(line.name || ''),
                renderFooterRaw(headers),
                renderHeaderRaw(headers),
            ]);

            await escpos.printRawByName(printerName, buf, `${jobPrefix} Ticket`);
            if (INTER_JOB_DELAY_MS) await sleep(INTER_JOB_DELAY_MS);
        }
    }

    if (printType === 'totals' || printType === 'both') {
        const buf = Buffer.concat([
            initPrinter(),
            renderTotalTicketRaw(items, totalEuros),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);

        await escpos.printRawByName(printerName, buf, `${jobPrefix} Total`);
    }
}

async function printSessionRequest({printerName, headers, sessionData}) {
    const jobPrefix = 'POS';

    const buf = Buffer.concat([
        initPrinter(),
        renderSessionRaw(sessionData),
        renderHeaderRaw(headers),
    ]);
    await escpos.printRawByName(printerName, buf, `${jobPrefix} Session Summary`);
}

async function listPrinters() {
    return escpos.listPrinters();
}

module.exports = {printTicketRequest, printSessionRequest, listPrinters};
