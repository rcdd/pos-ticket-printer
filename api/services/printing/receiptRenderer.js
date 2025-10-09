import {toEuros} from './utils.js';
import {
    escSelectCodepage, align, bold, horizontalLine, fullCut, sizeNormal, sizeWide, textPrintLine, fontUnderline,
    boldMedium, newLine, escInit, textPrint
} from "./printCommands.js";

/**
 * Helpers
 */
const collator = new Intl.Collator('pt-PT', {numeric: true, sensitivity: 'base'});
const getZoneName = (p) => (p?.zone?.name?.trim() || '(Sem zona)');

export function initPrinter() {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());
    return Buffer.concat(parts);
}

export function renderHeaderRaw(headers) {
    const parts = [];
    parts.push(escInit());
    parts.push(escSelectCodepage());
    parts.push(align(1)); // center
    parts.push(bold(1));
    if (headers?.firstLine) parts.push(textPrintLine(headers.firstLine));
    if (headers?.secondLine) parts.push(textPrintLine(headers.secondLine));
    parts.push(bold(0));
    parts.push(horizontalLine());
    parts.push(align(0)); // left
    parts.push(fullCut());
    return Buffer.concat(parts);
}

export function renderItemTicketRaw(productName) {
    const parts = [];
    parts.push(sizeWide());
    parts.push(textPrintLine(`1 ${productName ?? ''}`));
    parts.push(sizeNormal());
    parts.push(textPrintLine(''));
    return Buffer.concat(parts);
}

export function renderTotalTicketRaw(items, totalEuros) {
    const parts = [];
    parts.push(fontUnderline(1));
    parts.push(textPrintLine('Pedido:'));
    parts.push(fontUnderline(0));

    parts.push(newLine());

    parts.push(sizeWide());
    parts.push(boldMedium());
    for (const it of items) {
        parts.push(textPrintLine(`${it.quantity} ${it.name}`));
    }

    parts.push(newLine());

    parts.push(bold(1));
    parts.push(sizeWide());
    parts.push(textPrintLine(`Total: ${toEuros(totalEuros)}`));
    parts.push(sizeNormal());
    parts.push(bold(0));
    return Buffer.concat(parts);
}

export function renderFooterRaw() {
    const parts = [];
    const date = new Date().toLocaleString('pt-PT', {timeZone: 'Europe/Lisbon'});
    parts.push(align(1)); // center
    parts.push(horizontalLine());
    parts.push(textPrintLine(date));
    parts.push(newLine());
    parts.push(newLine());
    parts.push(align(0)); // left
    return Buffer.concat(parts);
}

export function renderSessionRaw(sessionData) {
    const parts = [];
    parts.push(align(1)); // center
    parts.push(bold(1));
    parts.push(textPrintLine('Resumo da Sessão'));
    parts.push(bold(0));
    parts.push(newLine());
    parts.push(horizontalLine());
    parts.push(newLine());
    parts.push(align(0)); // left

    const start = new Date(sessionData.openedAt).toLocaleString('pt-PT', {timeZone: 'Europe/Lisbon'});
    parts.push(textPrint(`Abertura: `));
    parts.push(bold(1));
    parts.push(textPrint(`${start}`));
    parts.push(bold(0));
    parts.push(textPrintLine(` por ${sessionData.userOpen || '-'}`));

    const end = new Date(sessionData.closedAt).toLocaleString('pt-PT', {timeZone: 'Europe/Lisbon'});
    parts.push(textPrint(`Fecho: `));
    parts.push(bold(1));
    parts.push(textPrint(`${end}`));
    parts.push(bold(0));
    parts.push(textPrintLine(` por ${sessionData.userClose || '-'}`));
    parts.push(newLine());

    parts.push(align(1)); // center
    parts.push(bold(1));
    parts.push(textPrintLine('Produtos Vendidos'));
    parts.push(bold(0));
    parts.push(align(0));

    const orderedProducts = [...sessionData.products].sort((a, b) => {
        const za = getZoneName(a);
        const zb = getZoneName(b);
        const byZone = collator.compare(za, zb);
        if (byZone !== 0) return byZone;
        return collator.compare(a?.name || '', b?.name || '');
    });

    let currentZone = null;
    for (const p of orderedProducts) {
        const z = getZoneName(p);
        if (z !== currentZone) {
            currentZone = z;
            parts.push(newLine());
            parts.push(fontUnderline(1));
            parts.push(textPrintLine(z));
            parts.push(fontUnderline(0));
        }
        parts.push(textPrintLine(`${p.quantity} x ${p.name} - ${toEuros((p.total || 0) / 100)}`));
    }

    if (Array.isArray(sessionData.discountedProducts) && sessionData.discountedProducts.length > 0) {
        parts.push(newLine());
        parts.push(fontUnderline(1));
        parts.push(textPrintLine('Produtos com Desconto:'));
        parts.push(fontUnderline(0));
        for (const p of sessionData.discountedProducts) {
            parts.push(textPrintLine(`${p.quantity} x ${p.name} - ${toEuros((p.total || 0) / 100)} (${p.discount}% Desconto)`));
        }
    }

    parts.push(newLine());
    parts.push(newLine());

    parts.push(align(1));
    parts.push(bold(1));
    parts.push(textPrintLine('Métodos de Pagamento'));
    parts.push(bold(0));
    parts.push(align(0));
    for (const p of sessionData.payments) {
        const method = p.method === 'cash' ? 'Dinheiro' : (p.method === 'card' ? 'Cartão' : p.method === "mbway" ? "MBWay" : p.method);
        parts.push(textPrintLine(`${method}: ${toEuros(p.amount / 100)}`));
    }
    parts.push(newLine());
    parts.push(newLine());

    parts.push(bold(1));
    parts.push(textPrintLine(`Número de Operações: ${sessionData.totalSales || 0}`));
    parts.push(bold(0));
    parts.push(newLine());

    parts.push(align(1)); // center
    parts.push(bold(1));
    parts.push(textPrintLine(`Resumo de Caixa`));
    parts.push(bold(0));
    parts.push(align(0));
    parts.push(textPrint(`Abertura: `));
    parts.push(bold(1));
    parts.push(textPrintLine(`${toEuros((sessionData.initialAmount || 0) / 100)}`));
    parts.push(bold(0));

    const cashMoney = sessionData.payments.find(p => p.method === 'cash')?.amount || 0;
    const moneyInCash = ((cashMoney + sessionData.initialAmount) / 100);
    parts.push(textPrint(`Fecho: `));
    parts.push(bold(1));
    parts.push(textPrintLine(`${toEuros(moneyInCash)}`));
    parts.push(bold(0));
    parts.push(newLine());

    parts.push(horizontalLine());
    parts.push(newLine());

    parts.push(boldMedium());
    parts.push(textPrint(`Total: `));
    parts.push(bold(1));
    parts.push(textPrintLine(`${toEuros(sessionData.closingAmount / 100)}`));
    parts.push(bold(0));
    parts.push(sizeNormal());

    parts.push(newLine());
    parts.push(horizontalLine());

    parts.push(newLine());

    if (sessionData.notes) {
        parts.push(bold(1));
        parts.push(textPrintLine('Observações:'));
        parts.push(bold(0));
        parts.push(textPrintLine(sessionData.notes));
        parts.push(newLine());
    }

    parts.push(newLine());

    return Buffer.concat(parts);
}

export function renderTestRaw(headers, ticketType, openDrawer, printerDetails) {
    const parts = [];
    parts.push(align(1));
    parts.push(bold(1));
    parts.push(textPrintLine('##### TEST PRINT #####'));
    parts.push(bold(0));
    parts.push(align(0));
    parts.push(newLine());
    parts.push(horizontalLine());
    parts.push(newLine());
    parts.push(bold(1));
    parts.push(textPrintLine("Settings:"));
    parts.push(bold(0));
    parts.push(newLine());
    parts.push(textPrintLine(`Header First Line: ${headers?.firstLine || 'n/a'}`));
    parts.push(textPrintLine(`Header Second Line: ${headers?.secondLine || 'n/a'}`));
    parts.push(textPrintLine(`Ticket Type: ${ticketType || 'n/a'}`));
    parts.push(textPrintLine(`Open Drawer: ${openDrawer ? 'Yes' : 'No'}`));
    parts.push(horizontalLine());
    parts.push(newLine());
    parts.push(bold(1));
    parts.push(textPrintLine("Printer Info:"));
    parts.push(bold(0));
    parts.push(newLine());
    parts.push(textPrintLine(`Name: ${printerDetails?.name || 'n/a'}`));
    parts.push(textPrintLine(`Driver: ${printerDetails?.driverName || 'n/a'}`));
    parts.push(textPrintLine(`Status: ${printerDetails?.state || 'n/a'}`));
    parts.push(textPrintLine(`Location: ${printerDetails?.location || 'n/a'}`));
    parts.push(textPrintLine(`Description: ${printerDetails?.description || 'n/a'}`));
    parts.push(textPrintLine(`System Name: ${printerDetails?.systemName || 'n/a'}`));
    parts.push(textPrintLine(`URI: ${printerDetails?.uri || 'n/a'}`));
    parts.push(textPrintLine(`Port: ${printerDetails?.portName || 'n/a'}`));
    parts.push(horizontalLine());
    parts.push(newLine());
    parts.push(align(1));
    parts.push(textPrint("Date/Time:"));
    const now = new Date().toLocaleString('pt-PT', {timeZone: 'Europe/Lisbon'});
    parts.push(textPrintLine(now));
    parts.push(align(0));
    parts.push(newLine());
    parts.push(newLine());
    parts.push(newLine());

    return Buffer.concat(parts);
}