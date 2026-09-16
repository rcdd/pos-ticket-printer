import {
    renderHeaderRaw, renderHeaderContentRaw, renderItemTicketRaw, renderTotalTicketRaw, renderFooterRaw,
    initPrinter, renderSessionRaw, renderTestRaw,
} from './receiptRenderer.js';
import {EscposStrategy} from "./escposStrategy.js";
import {openCashDrawer, fullCut, feed, configurePrint, DEFAULT_TICKET_LAYOUT} from "./printCommands.js";
import {renderOrderTicketRaw, renderOrderVoidRaw} from "./orderRenderer.js";

const escpos = new EscposStrategy();

// How tickets are laid out and cut (see options.getPrintProfileVariable):
// - legacy: body → date footer → header + cut at the END. Compensates the
//   head↔cutter gap of older printers (the trailing header lands after the
//   blade and becomes the top of the NEXT ticket). Default — existing installs.
// - standard: header → body → date footer → feed(N) → cut. For modern printers
//   without a relevant gap. cutMode 'auto' additionally drops our cut command
//   and sends EACH ticket as its own print job, so the printer's end-of-job
//   auto-cutter separates them (otherwise multi-ticket jobs would come out glued).
export const DEFAULT_PRINT_PROFILE = Object.freeze({
    headerPosition: 'trailing', // 'trailing' (old printers, header before the cut) | 'top'
    cutMode: 'command',         // 'command' | 'auto' (printer's own end-of-job cutter)
    feedLines: 4,
    columns: 48,                // Font A characters per line (printer-specific)
    codepage: 'cp1252',         // 'cp1252' | 'cp858' | 'cp850'
    drawerPin: 2,               // 2 | 5
    fontSmall: false,
    layout: DEFAULT_TICKET_LAYOUT, // per-element text sizes ('legacy' = historical bytes)
});

// Normalizes the profile and applies the character/width/drawer settings to
// printCommands. Buffer assembly is synchronous after this call, so the
// module-level settings cannot be raced by another request.
const applyProfile = (profile) => {
    const prof = {...DEFAULT_PRINT_PROFILE, ...(profile ?? {})};
    configurePrint({
        codepage: prof.codepage,
        columns: prof.columns,
        fontSmall: prof.fontSmall,
        drawerPin: prof.drawerPin,
        layout: prof.layout,
    });
    return prof;
};
const isTrailingHeader = (prof) => prof.headerPosition !== 'top';

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

// one complete ticket in the standard (modern) layout
function standardTicket(profile, headers, bodyBuf) {
    const parts = [
        initPrinter(),
        renderHeaderContentRaw(headers),
        bodyBuf,
        renderFooterRaw(headers),
        feed(profile.feedLines),
    ];
    if (profile.cutMode !== 'auto') {
        parts.push(fullCut());
    }
    return Buffer.concat(parts);
}

// cutMode 'auto': one print job per ticket (the printer cuts between jobs);
// otherwise everything goes as a single job with explicit cut commands.
async function sendJobs(printerName, jobs, jobName, profile) {
    if (jobs.length === 0) return;
    if (profile.cutMode === 'auto') {
        for (const job of jobs) {
            await escpos.printRawByName(printerName, job, jobName);
        }
        return;
    }
    await escpos.printRawByName(printerName, Buffer.concat(jobs), jobName);
}

export async function printTicketRequest({printerName, headers, items, totalAmount, printType, openDrawer, isTest, receiptTitle, profile}) {
    const prof = applyProfile(profile);
    const totalEuros = toEuros(totalAmount);
    const expanded = expandItems(items);
    const jobPrefix = 'POS';

    if (isTest) {
        const printerDetails = await escpos.getPrinterDetails(printerName);
        if (isTrailingHeader(prof)) {
            const buf = Buffer.concat([
                renderTestRaw(headers, printType, openDrawer, printerDetails),
                renderHeaderRaw(headers),
            ]);
            await escpos.printRawByName(printerName, buf, `${jobPrefix} Test Print`);
        } else {
            const job = standardTicket(prof, headers, renderTestRaw(headers, printType, openDrawer, printerDetails));
            await sendJobs(printerName, [job], `${jobPrefix} Test Print`, prof);
        }
        return;
    }

    if (isTrailingHeader(prof)) {
        let buf = Buffer.concat([initPrinter()]);

        if (openDrawer) {
            buf = Buffer.concat([buf, openCashDrawer()]);
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
                renderTotalTicketRaw(items, totalEuros, receiptTitle || 'Pedido:'),
                renderFooterRaw(headers),
                renderHeaderRaw(headers),
            ]);
        }

        await escpos.printRawByName(printerName, buf, `${jobPrefix} Job`);
        return;
    }

    const jobs = [];
    if (printType === 'tickets' || printType === 'both') {
        for (const line of expanded) {
            jobs.push(standardTicket(prof, headers, renderItemTicketRaw(line.name || '')));
        }
    }
    if (printType === 'totals' || printType === 'both') {
        jobs.push(standardTicket(prof, headers, renderTotalTicketRaw(items, totalEuros, receiptTitle || 'Pedido:')));
    }
    if (openDrawer && jobs.length > 0) {
        jobs[0] = Buffer.concat([openCashDrawer(), jobs[0]]);
    }
    await sendJobs(printerName, jobs, `${jobPrefix} Job`, prof);
}

export async function printSessionRequest({printerName, headers, sessionData, openDrawer, profile}) {
    const prof = applyProfile(profile);
    const jobPrefix = 'POS';

    if (isTrailingHeader(prof)) {
        let buf = Buffer.concat([
            initPrinter(),
            renderSessionRaw(sessionData),
            renderHeaderRaw(headers),
        ]);

        if (openDrawer) {
            buf = Buffer.concat([openCashDrawer(), buf]);
        }
        await escpos.printRawByName(printerName, buf, `${jobPrefix} Session Summary`);
        return;
    }

    let job = standardTicket(prof, headers, renderSessionRaw(sessionData));
    if (openDrawer) {
        job = Buffer.concat([openCashDrawer(), job]);
    }
    await sendJobs(printerName, [job], `${jobPrefix} Session Summary`, prof);
}

export async function listPrinters() {
    return await escpos.listPrinters();
}

// Drawer kick only — used by the settings "test drawer" button to validate
// the configured pin without printing anything.
export async function kickDrawer({printerName, profile}) {
    applyProfile(profile);
    await escpos.printRawByName(printerName, openCashDrawer(), 'POS Drawer Kick');
}

// Full order/void ticket jobs. In legacy mode the header (+cut) trails the
// content — the house scheme; in standard mode the header opens the ticket.
export function buildOrderTicketJob({headers, profile, ...content}) {
    const prof = applyProfile(profile);
    if (isTrailingHeader(prof)) {
        return Buffer.concat([
            renderOrderTicketRaw(content),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);
    }
    return standardTicket(prof, headers, renderOrderTicketRaw(content));
}

export function buildOrderVoidJob({headers, profile, ...content}) {
    const prof = applyProfile(profile);
    if (isTrailingHeader(prof)) {
        return Buffer.concat([
            renderOrderVoidRaw(content),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);
    }
    return standardTicket(prof, headers, renderOrderVoidRaw(content));
}

export async function printOrderTicket({printerName, profile, ...job}) {
    const prof = applyProfile(profile);
    await sendJobs(printerName, [buildOrderTicketJob({profile: prof, ...job})], `POS Pedido ${job.number}`, prof);
}

export async function printOrderVoid({printerName, profile, ...job}) {
    const prof = applyProfile(profile);
    await sendJobs(printerName, [buildOrderVoidJob({profile: prof, ...job})], `POS Anulacao ${job.number}`, prof);
}
