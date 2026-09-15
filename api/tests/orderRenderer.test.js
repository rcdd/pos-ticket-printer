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

test('standard profile: header opens the ticket, feed before a single cut', () => {
    const profile = {headerPosition: 'top', feedLines: 5, cutMode: 'command'};
    const buf = buildOrderTicketJob({
        headers: HEADERS, profile,
        number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}],
    });
    const text = asText(buf);

    const headerIdx = text.indexOf('Festa da Aldeia');
    const contentIdx = text.indexOf('Sopa');
    assert.ok(headerIdx >= 0 && headerIdx < contentIdx, 'header must come BEFORE the content');
    assert.ok(buf.includes(FULL_CUT), 'cut command present in command mode');
    // feed lines right before the cut
    const cutIdx = buf.indexOf(FULL_CUT);
    const before = buf.subarray(cutIdx - 5, cutIdx);
    assert.deepEqual([...before], [0x0A, 0x0A, 0x0A, 0x0A, 0x0A], '5 feed lines before the cut');
});

test('standard profile with auto-cut: no cut command in the job', () => {
    const profile = {headerPosition: 'top', feedLines: 4, cutMode: 'auto'};
    const buf = buildOrderVoidJob({
        headers: HEADERS, profile,
        number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}],
    });
    assert.ok(!buf.includes(FULL_CUT), 'auto mode must not embed cut commands');
    assert.match(asText(buf), /Festa da Aldeia[\s\S]*Sopa/);
});

test('paper width switches the separator line (80mm=48 cols, 58mm=32 cols)', () => {
    const base = {headers: HEADERS, number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]};

    const wide = asText(buildOrderTicketJob({...base, profile: {paperWidth: 80}}));
    assert.ok(wide.includes('_'.repeat(48)), '48-column separator on 80mm');

    const narrow = asText(buildOrderTicketJob({...base, profile: {paperWidth: 58}}));
    assert.ok(narrow.includes('_'.repeat(32)), '32-column separator on 58mm');
    assert.ok(!narrow.includes('_'.repeat(48)), 'no 48-column line on 58mm');
});

test('codepage cp858 selects ESC t 19 and encodes € as 0xD5', () => {
    const buf = buildOrderTicketJob({
        headers: HEADERS, profile: {codepage: 'cp858'},
        number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'Menu 5€'}],
    });
    assert.ok(buf.includes(Buffer.from([0x1B, 0x74, 19])), 'ESC t 19 (PC858 table)');
    assert.ok(buf.includes(Buffer.from([0xD5])), '€ encoded as 0xD5');

    // default cp1252: ESC t 16 and € as 0x80
    const def = buildOrderTicketJob({
        headers: HEADERS, number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: '5€'}],
    });
    assert.ok(def.includes(Buffer.from([0x1B, 0x74, 16])));
    assert.ok(def.includes(Buffer.from([0x80])));
});

test('small font sends ESC M 1; drawer pin 5 changes the kick byte', async () => {
    const small = buildOrderTicketJob({
        headers: HEADERS, profile: {fontSmall: true},
        number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}],
    });
    assert.ok(small.includes(Buffer.from([0x1B, 0x4D, 1])), 'Font B selected');
    assert.ok(small.includes(Buffer.from('_'.repeat(64))), '64 columns with Font B on 80mm');

    const {configurePrint, openCashDrawer, resetPrintSettings} = await import('../services/printing/printCommands.js');
    configurePrint({drawerPin: 5});
    assert.deepEqual([...openCashDrawer()], [0x1B, 0x70, 0x01, 0x19, 0xFA]);
    configurePrint({drawerPin: 2});
    assert.deepEqual([...openCashDrawer()], [0x1B, 0x70, 0x00, 0x19, 0xFA]);
    resetPrintSettings();
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
