import {
    renderHeaderRaw, renderHeaderContentRaw, renderItemTicketRaw, renderTotalTicketRaw, renderFooterRaw,
    initPrinter, renderSessionRaw, renderTestRaw,
} from './receiptRenderer.js';
import {EscposStrategy} from "./escposStrategy.js";
import {openCashDrawer, fullCut, feed, configurePrint, DEFAULT_TICKET_LAYOUT} from "./printCommands.js";
import {renderOrderTicketRaw, renderOrderVoidRaw, renderOrderMoveRaw, renderPickupTicketRaw} from "./orderRenderer.js";
import {expandTicketBundles} from "./ticketBundles.js";

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
    layout: DEFAULT_TICKET_LAYOUT, // per-element text sizes (defaults match the historical output)
});

// Normalizes the profile and applies the character/width/drawer settings to
// printCommands. Buffer assembly is synchronous after this call, so the
// module-level settings cannot be raced by another request — keep it that
// way: never await between applyProfile() and building the buffers (with
// several printers, each one has its own profile).
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
                    lines.push({productId: Number(p?.id) || null, name: String(p?.name || '').trim()});
                }
            }
        } else {
            for (let i = 0; i < qty; i++) {
                lines.push({productId: Number(it?.id) || null, name: String(it?.name || '').trim()});
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

// ticketLines (optional): the individual tickets to print instead of one per
// item of `items` — a direct sale with items routed to another printer only
// prints tickets for what is collected at the register; the totals receipt
// still lists everything.
// bundles (optional, direct sales only): Map productId → {count, label, name}
// of the products sold as individual tickets ("Metro de Cerveja") — those
// tickets print even when the print type is 'totals', it is the whole point
// of the product.
export async function printTicketRequest({printerName, headers, items, ticketLines, bundles, totalAmount, printType, openDrawer, isTest, receiptTitle, payments, profile}) {
    const prof = applyProfile(profile);
    const totalEuros = toEuros(totalAmount);
    const expanded = expandTicketBundles(ticketLines ?? expandItems(items), bundles);
    const withTickets = printType === 'tickets' || printType === 'both';
    const ticketsToPrint = withTickets ? expanded : expanded.filter((line) => line.bundle);
    const jobPrefix = 'POS';

    if (isTest) {
        const printerDetails = await escpos.getPrinterDetails(printerName);
        applyProfile(profile); // re-applied: the lookup above awaited
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

        for (const line of ticketsToPrint) {
            buf = Buffer.concat([
                buf,
                renderItemTicketRaw(line.name || '', line.subtitle),
                renderFooterRaw(headers),
                renderHeaderRaw(headers)]);
        }

        if (printType === 'totals' || printType === 'both') {
            buf = Buffer.concat([
                buf,
                renderTotalTicketRaw(items, totalEuros, receiptTitle || 'Pedido:', payments),
                renderFooterRaw(headers),
                renderHeaderRaw(headers),
            ]);
        }

        await escpos.printRawByName(printerName, buf, `${jobPrefix} Job`);
        return;
    }

    const jobs = [];
    for (const line of ticketsToPrint) {
        jobs.push(standardTicket(prof, headers, renderItemTicketRaw(line.name || '', line.subtitle)));
    }
    if (printType === 'totals' || printType === 'both') {
        jobs.push(standardTicket(prof, headers, renderTotalTicketRaw(items, totalEuros, receiptTitle || 'Pedido:', payments)));
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

// Table-change correction ticket (same job assembly as the other order jobs)
export function buildOrderMoveJob({headers, profile, ...content}) {
    const prof = applyProfile(profile);
    if (isTrailingHeader(prof)) {
        return Buffer.concat([
            renderOrderMoveRaw(content),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);
    }
    return standardTicket(prof, headers, renderOrderMoveRaw(content));
}

export async function printOrderMove({printerName, profile, ...job}) {
    const prof = applyProfile(profile);
    await sendJobs(printerName, [buildOrderMoveJob({profile: prof, ...job})], `POS Correcao ${job.number}`, prof);
}

// Customer's pickup ticket (direct sale, items prepared at another printer)
export function buildPickupTicketJob({headers, profile, ...content}) {
    const prof = applyProfile(profile);
    if (isTrailingHeader(prof)) {
        return Buffer.concat([
            renderPickupTicketRaw(content),
            renderFooterRaw(headers),
            renderHeaderRaw(headers),
        ]);
    }
    return standardTicket(prof, headers, renderPickupTicketRaw(content));
}

export async function printPickupTicket({printerName, profile, ...job}) {
    const prof = applyProfile(profile);
    await sendJobs(printerName, [buildPickupTicketJob({profile: prof, ...job})], `POS Levantamento ${job.number}`, prof);
}
