import test from 'node:test';
import assert from 'node:assert/strict';
import {renderOrderTicketRaw, renderOrderVoidRaw, formatOrderNumber} from '../services/printing/orderRenderer.js';
import {buildOrderTicketJob, buildOrderVoidJob} from '../services/printing/printService.js';

// ESC/POS buffers mix binary commands with cp1252 text; for assertions
// it's enough to look for the (ASCII) text inside the buffer.
const asText = (buffer) => buffer.toString('latin1');
const FULL_CUT = Buffer.from([0x1B, 0x6D, 0x00]);
const HEADERS = {firstLine: 'Festa da Aldeia', secondLine: 'Comissao de Festas'};

test('formatOrderNumber pads with zeros', () => {
    assert.equal(formatOrderNumber(7), '#007');
    assert.equal(formatOrderNumber(42), '#042');
    assert.equal(formatOrderNumber(1234), '#1234');
});

test('table ticket: TABLE highlighted, order number only as a small reference', () => {
    const text = asText(renderOrderTicketRaw({
        number: 42,
        tableNumber: '12B',
        items: [
            {quantity: 2, nameSnapshot: 'Francesinha'},
            {quantity: 1, nameSnapshot: 'Imperial'},
        ],
        note: 'sem picante',
        waiterName: 'Joao',
    }));

    assert.match(text, /MESA/);
    assert.match(text, /12B/);
    assert.match(text, /2x Francesinha/);
    assert.match(text, /1x Imperial/);
    assert.match(text, /Obs: sem picante/);
    assert.match(text, /Pedido #042 · Joao/);
    assert.doesNotMatch(text, /BALCAO/);
});

test('standalone ticket: the giant number is the customer identity', () => {
    const text = asText(renderOrderTicketRaw({
        number: 3,
        tableNumber: null,
        items: [{quantity: 1, nameSnapshot: 'Bifana'}],
        waiterName: 'Joao',
    }));

    assert.match(text, /PEDIDO/);
    assert.match(text, /#003/);
    assert.match(text, /BALCAO \/ AVULSO/);
    assert.match(text, /Joao/);
});

test('reprint is marked as a duplicate copy', () => {
    const text = asText(renderOrderTicketRaw({
        number: 5,
        tableNumber: '4A',
        items: [{quantity: 1, nameSnapshot: 'Bifana'}],
        reprint: true,
    }));
    assert.match(text, /2. VIA/); // "2ª" in cp1252
});

test('void ticket: negative items, table and approver', () => {
    const text = asText(renderOrderVoidRaw({
        number: 42,
        tableNumber: '12B',
        items: [{quantity: 1, nameSnapshot: 'Imperial'}],
        approvedByName: 'Chefe',
    }));

    assert.match(text, /ANULACAO/);
    assert.match(text, /MESA 12B/);
    assert.match(text, /-1x Imperial/);
    assert.match(text, /Pedido #042 · Aprovado por: Chefe/);
});

test('renderers do not cut paper — the cut belongs to the full job', () => {
    for (const buf of [
        renderOrderTicketRaw({number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]}),
        renderOrderVoidRaw({number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]}),
    ]) {
        assert.ok(!buf.includes(FULL_CUT), 'content must not include a cut');
    }
});

test('full job follows the house scheme: content → date → header + cut at the end', () => {
    for (const buf of [
        buildOrderTicketJob({headers: HEADERS, number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}]}),
        buildOrderVoidJob({headers: HEADERS, number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}]}),
    ]) {
        const text = asText(buf);
        assert.match(text, /Festa da Aldeia/);
        assert.match(text, /Comissao de Festas/);
        assert.ok(buf.includes(FULL_CUT), 'the full job ends with a cut');

        // the header (which becomes the next ticket's top) comes AFTER the content
        const contentIdx = text.indexOf('Sopa');
        const headerIdx = text.indexOf('Festa da Aldeia');
        const cutIdx = buf.indexOf(FULL_CUT);
        assert.ok(contentIdx < headerIdx, 'content before header');
        assert.ok(headerIdx < cutIdx || buf.lastIndexOf(FULL_CUT) > headerIdx, 'cut only after the header');
    }
});
