import {
    escInit, escSelectCodepage, align, bold, size, sizeNormal, sizeWide, boldMedium,
    textPrintLine, horizontalLine, newLine,
} from './printCommands.js';

export const formatOrderNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;

// NOTA sobre corte/avanços: estes renderers produzem SÓ o conteúdo do talão.
// O trabalho completo é montado em printService (conteúdo → footer com data e
// avanços → header da casa + corte), o mesmo esquema dos talões clássicos —
// nas impressoras com folga entre a cabeça e a guilhotina, o header impresso
// antes do corte cai abaixo dele e vira o topo do talão seguinte, e assim
// nunca se perde texto.

// Talão de pedido para a cozinha/bar. Nas mesas, o destaque é a MESA
// (é o que a cozinha e a sala usam); o nº do pedido fica numa linha
// pequena de referência (2ª via/auditoria). Nos avulsos, o nº é a
// identidade do cliente e mantém-se gigante.
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

    // referência pequena: nº do pedido (nas mesas) + empregado
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

// Talão de anulação: avisa a cozinha que itens de um pedido foram cancelados.
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
