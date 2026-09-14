import {
    escInit, escSelectCodepage, align, bold, size, sizeNormal, sizeWide, boldMedium,
    textPrintLine, horizontalLine, newLine,
} from './printCommands.js';

export const formatOrderNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;

// NOTE on cut/feeds: these renderers produce ONLY the ticket content.
// The full job is assembled in printService (content → footer with date and
// feeds → shop header + cut), same scheme as the classic tickets — on
// printers with a gap between the print head and the cutter, the header
// printed right before the cut lands below it and becomes the top of the
// next ticket, so no text is ever lost.

// Kitchen/bar order ticket. For table orders the highlight is the TABLE
// (what kitchen and floor staff use); the order number goes on a small
// reference line (reprints/audit). For standalone orders the number is
// the customer's identity and stays giant.
export function renderOrderTicketRaw({number, tableNumber, items = [], note, waiterName, reprint = false}) {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());

    parts.push(align(1));
    if (reprint) {
        parts.push(bold(1));
        parts.push(textPrintLine('** 2ª VIA **'));
        parts.push(bold(0));
    }
    parts.push(bold(1));
    if (tableNumber) {
        parts.push(size(0x11)); // 2x2
        parts.push(textPrintLine('MESA'));
        parts.push(size(0x22)); // 3x3
        parts.push(textPrintLine(String(tableNumber)));
    } else {
        parts.push(size(0x11));
        parts.push(textPrintLine('PEDIDO'));
        parts.push(size(0x22));
        parts.push(textPrintLine(formatOrderNumber(number)));
        parts.push(sizeNormal());
        parts.push(sizeWide());
        parts.push(textPrintLine('BALCAO / AVULSO'));
    }
    parts.push(sizeNormal());
    parts.push(bold(0));

    parts.push(horizontalLine());
    parts.push(align(0));

    parts.push(boldMedium());
    for (const item of items) {
        parts.push(textPrintLine(`${item.quantity}x ${item.nameSnapshot ?? item.name ?? ''}`));
    }
    parts.push(sizeNormal());

    if (note) {
        parts.push(newLine());
        parts.push(bold(1));
        parts.push(textPrintLine(`Obs: ${note}`));
        parts.push(bold(0));
    }

    // small reference line: order number (table orders) + waiter
    const refParts = [];
    if (tableNumber) refParts.push(`Pedido ${formatOrderNumber(number)}`);
    if (waiterName) refParts.push(String(waiterName));
    if (refParts.length) {
        parts.push(newLine());
        parts.push(align(1));
        parts.push(textPrintLine(refParts.join(' · ')));
        parts.push(align(0));
    }

    return Buffer.concat(parts);
}

// Void ticket: tells the kitchen that items of an order were cancelled.
export function renderOrderVoidRaw({number, tableNumber, items = [], approvedByName}) {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());

    parts.push(align(1));
    parts.push(bold(1));
    parts.push(size(0x11));
    parts.push(textPrintLine('** ANULACAO **'));
    parts.push(size(0x22));
    parts.push(textPrintLine(tableNumber ? `MESA ${tableNumber}` : formatOrderNumber(number)));
    parts.push(sizeNormal());
    parts.push(bold(0));

    parts.push(horizontalLine());
    parts.push(align(0));

    parts.push(boldMedium());
    for (const item of items) {
        parts.push(textPrintLine(`-${item.quantity}x ${item.nameSnapshot ?? item.name ?? ''}`));
    }
    parts.push(sizeNormal());

    const refParts = [`Pedido ${formatOrderNumber(number)}`];
    if (approvedByName) refParts.push(`Aprovado por: ${approvedByName}`);
    parts.push(newLine());
    parts.push(align(1));
    parts.push(textPrintLine(refParts.join(' · ')));
    parts.push(align(0));

    return Buffer.concat(parts);
}
