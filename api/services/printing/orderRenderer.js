import {
    escInit, escSelectCodepage, align, bold, size, sizeNormal,
    textPrintLine, horizontalLine, newLine, layoutValue, SIZE_BYTES,
} from './printCommands.js';

export const formatOrderNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;

// MESA/PEDIDO block: the label line ("MESA"/"PEDIDO") and the value line
// (table / order number) are sized independently via the layout elements
// orderLabel and orderValue. The BALCAO/AVULSO subline of standalone orders
// keeps its historical fixed 3×1.
const orderLabelSize = () => size(SIZE_BYTES[layoutValue('orderLabel')]);
const orderValueSize = () => size(SIZE_BYTES[layoutValue('orderValue')]);

// item lines of order/void tickets
const pushOrderItemsStyle = (parts) => {
    parts.push(size(SIZE_BYTES[layoutValue('orderItem')]));
    parts.push(bold(1));
    return () => {
        parts.push(sizeNormal());
        parts.push(bold(0));
    };
};

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
// destination line ("» COZINHA") shown when order tickets are split per zone;
// size configurable like the other layout elements
const pushZoneLabel = (parts, zoneLabel) => {
    if (!zoneLabel) return;
    parts.push(size(SIZE_BYTES[layoutValue('orderZone')] ?? SIZE_BYTES.medium));
    parts.push(bold(1));
    parts.push(textPrintLine(`» ${String(zoneLabel).toUpperCase()}`));
    parts.push(sizeNormal());
    parts.push(bold(0));
};

export function renderOrderTicketRaw({number, tableNumber, items = [], note, waiterName, reprint = false, zoneLabel = null}) {
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
        parts.push(orderLabelSize()); // default: 2x2
        parts.push(textPrintLine('MESA'));
        parts.push(orderValueSize()); // default: 3x3
        parts.push(textPrintLine(String(tableNumber)));
    } else {
        parts.push(orderLabelSize());
        parts.push(textPrintLine('PEDIDO'));
        parts.push(orderValueSize());
        parts.push(textPrintLine(formatOrderNumber(number)));
        parts.push(size(SIZE_BYTES.extraWide));
        parts.push(textPrintLine('BALCAO / AVULSO'));
    }
    parts.push(sizeNormal());
    parts.push(bold(0));
    pushZoneLabel(parts, zoneLabel);

    parts.push(horizontalLine());
    parts.push(align(0));

    const endItemsStyle = pushOrderItemsStyle(parts);
    for (const item of items) {
        parts.push(textPrintLine(`${item.quantity}x ${item.nameSnapshot ?? item.name ?? ''}`));
    }
    endItemsStyle();

    if (note) {
        parts.push(newLine());
        parts.push(size(SIZE_BYTES[layoutValue('orderNote')]));
        parts.push(bold(1));
        parts.push(textPrintLine(`Obs: ${note}`));
        parts.push(sizeNormal());
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

// Correction ticket: tells the kitchen/bar that an order changed table, so
// the food is delivered to the right place (their original ticket still says
// the old table).
export function renderOrderMoveRaw({number, fromLabel, toLabel, movedByName}) {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());

    parts.push(align(1));
    parts.push(bold(1));
    parts.push(size(SIZE_BYTES[layoutValue('orderLabel')]));
    parts.push(textPrintLine('** CORRECAO **'));
    parts.push(textPrintLine(`Pedido ${formatOrderNumber(number)}`));
    parts.push(size(SIZE_BYTES[layoutValue('orderValue')]));
    parts.push(textPrintLine(`${fromLabel} > ${toLabel}`));
    parts.push(sizeNormal());
    parts.push(bold(0));

    parts.push(horizontalLine());
    if (movedByName) {
        parts.push(textPrintLine(`Movido por: ${movedByName}`));
    }
    parts.push(align(0));

    return Buffer.concat(parts);
}

// Void ticket: tells the kitchen that items of an order were cancelled.
export function renderOrderVoidRaw({number, tableNumber, items = [], approvedByName, zoneLabel = null}) {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());

    parts.push(align(1));
    parts.push(bold(1));
    parts.push(orderLabelSize()); // default: 2x2
    parts.push(textPrintLine('** ANULACAO **'));
    parts.push(orderValueSize()); // default: 3x3
    parts.push(textPrintLine(tableNumber ? `MESA ${tableNumber}` : formatOrderNumber(number)));
    parts.push(sizeNormal());
    parts.push(bold(0));
    pushZoneLabel(parts, zoneLabel);

    parts.push(horizontalLine());
    parts.push(align(0));

    const endItemsStyle = pushOrderItemsStyle(parts);
    for (const item of items) {
        parts.push(textPrintLine(`-${item.quantity}x ${item.nameSnapshot ?? item.name ?? ''}`));
    }
    endItemsStyle();

    const refParts = [`Pedido ${formatOrderNumber(number)}`];
    if (approvedByName) refParts.push(`Aprovado por: ${approvedByName}`);
    parts.push(newLine());
    parts.push(align(1));
    parts.push(textPrintLine(refParts.join(' · ')));
    parts.push(align(0));

    return Buffer.concat(parts);
}
