import test from 'node:test';
import assert from 'node:assert/strict';
import {
    initPrinter, renderHeaderRaw, renderItemTicketRaw, renderTotalTicketRaw, renderFooterRaw, renderSessionRaw,
} from '../services/printing/receiptRenderer.js';
import {toEuros} from '../services/printing/utils.js';

const asText = (buffer) => buffer.toString('latin1');
const FULL_CUT = Buffer.from([0x1B, 0x6D, 0x00]);

test('toEuros formata euros em pt-PT', () => {
    assert.equal(toEuros(1.5).replace(/ /g, ' '), '1,50 €');
    assert.equal(toEuros('abc').replace(/ /g, ' '), '0,00 €');
});

test('initPrinter começa com ESC @ (reset)', () => {
    const buf = initPrinter();
    assert.deepEqual([...buf.subarray(0, 2)], [0x1B, 0x40]);
});

test('renderHeaderRaw imprime as duas linhas e corta o papel', () => {
    const buf = renderHeaderRaw({firstLine: 'Festa da Aldeia', secondLine: 'Comissao de Festas'});
    const text = asText(buf);
    assert.match(text, /Festa da Aldeia/);
    assert.match(text, /Comissao de Festas/);
    assert.ok(buf.includes(FULL_CUT));
});

test('renderHeaderRaw omite linhas vazias sem falhar', () => {
    const text = asText(renderHeaderRaw({}));
    assert.ok(text.length > 0);
});

test('renderItemTicketRaw imprime o item precedido de "1"', () => {
    const text = asText(renderItemTicketRaw('Bifana'));
    assert.match(text, /1 Bifana/);
});

test('renderTotalTicketRaw lista itens e total em euros', () => {
    const items = [
        {quantity: 2, name: 'Imperial'},
        {quantity: 1, name: 'Francesinha'},
    ];
    const text = asText(renderTotalTicketRaw(items, 12.5));
    assert.match(text, /Pedido:/);
    assert.match(text, /2 Imperial/);
    assert.match(text, /1 Francesinha/);
    assert.match(text, /Total: 12,50/);
});

test('renderFooterRaw inclui a data', () => {
    const year = String(new Date().getFullYear());
    const text = asText(renderFooterRaw({}));
    assert.ok(text.includes(year), 'esperava o ano atual no rodapé');
});

test('renderSessionRaw agrupa produtos por zona e mostra utilizadores', () => {
    const text = asText(renderSessionRaw({
        sessionId: 7,
        openedAt: '2026-09-09T08:00:00Z',
        closedAt: '2026-09-09T20:00:00Z',
        userOpen: 'Chefe',
        userClose: 'Rben',
        initialAmount: 5000,
        totalSales: 2,
        payments: [{method: 'cash', amount: 2450}],
        products: [
            {name: 'Imperial', quantity: 3, total: 450, zone: {name: 'Bar'}},
            {name: 'Francesinha', quantity: 1, total: 950, zone: {name: 'Cozinha'}},
        ],
        discountedProducts: [],
        closingAmount: 1400,
        finalCashValue: 6400,
        cashMovements: [],
    }));

    assert.match(text, /Resumo da Sess/);
    assert.match(text, /Chefe/);
    assert.match(text, /Bar/);
    assert.match(text, /Cozinha/);
    assert.match(text, /3 x Imperial/);
    assert.match(text, /1 x Francesinha/);
});
