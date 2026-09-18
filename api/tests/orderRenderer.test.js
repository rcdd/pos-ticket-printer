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

test('configured columns set the separator line length exactly', () => {
    const base = {headers: HEADERS, number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]};

    for (const columns of [48, 42, 32]) {
        const text = asText(buildOrderTicketJob({...base, profile: {columns}}));
        assert.ok(text.includes('_'.repeat(columns)), `${columns}-column separator present`);
        assert.ok(!text.includes('_'.repeat(columns + 1)), `separator never exceeds ${columns} columns`);
    }
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
    assert.ok(small.includes(Buffer.from('_'.repeat(64))), '64 columns with Font B at 48-column base');

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

// --- Ticket layout (per-element text sizes; defaults = concrete equivalents
// of the historical output) ---

test('layout defaults render the documented concrete sizes', async () => {
    const {renderItemTicketRaw, renderTotalTicketRaw} = await import('../services/printing/receiptRenderer.js');
    const {resetPrintSettings} = await import('../services/printing/printCommands.js');

    resetPrintSettings();
    const item = renderItemTicketRaw('Bifana');
    assert.ok(item.includes(Buffer.from([0x1D, 0x21, 0x12])), 'item name: 2x3 (mediumTall)');
    assert.ok(!item.includes(Buffer.from([0x1D, 0x21, 26])), 'out-of-spec GS ! 26 is gone');

    const totals = renderTotalTicketRaw([{quantity: 1, name: 'Bifana'}], 3.5);
    assert.ok(totals.includes(Buffer.from([0x1D, 0x21, 0x20])), 'totals: 3x1 (extraWide)');

    const base = {headers: HEADERS, number: 1, tableNumber: '2A', items: [{quantity: 1, nameSnapshot: 'X'}]};
    const order = buildOrderTicketJob(base);
    assert.ok(order.includes(Buffer.from([0x1D, 0x21, 0x11])), 'order: 2x2 label');
    assert.ok(order.includes(Buffer.from([0x1D, 0x21, 0x22])), 'order: 3x3 value');
    assert.ok(order.includes(Buffer.from([0x1D, 0x21, 0x10])), 'order items: 2x1 (wide)');
    assert.ok(!order.includes(Buffer.from([0x1B, 0x21, 0x20])), 'no ESC ! double-width left');
});

test('itemName size option changes the emitted GS ! byte', async () => {
    const {renderItemTicketRaw} = await import('../services/printing/receiptRenderer.js');
    const {configurePrint, resetPrintSettings} = await import('../services/printing/printCommands.js');

    configurePrint({layout: {itemName: 'medium'}});
    const buf = renderItemTicketRaw('Bifana');
    assert.ok(buf.includes(Buffer.from([0x1D, 0x21, 0x11])), 'GS ! 2x2 present');
    assert.ok(!buf.includes(Buffer.from([0x1D, 0x21, 0x12])), 'default 2x3 replaced');
    resetPrintSettings();
});

test('orderLabel and orderValue size the MESA block independently', () => {
    const base = {headers: HEADERS, number: 42, tableNumber: '12B', items: [{quantity: 1, nameSnapshot: 'X'}]};

    const custom = buildOrderTicketJob({...base, profile: {layout: {orderLabel: 'tall', orderValue: 'medium'}}});
    assert.ok(custom.includes(Buffer.from([0x1D, 0x21, 0x01])), 'label 1x2');
    assert.ok(custom.includes(Buffer.from([0x1D, 0x21, 0x11])), 'value 2x2');
    assert.ok(!custom.includes(Buffer.from([0x1D, 0x21, 0x22])), 'default 3x3 replaced');

    const voidSmall = buildOrderVoidJob({...base, profile: {layout: {orderLabel: 'normal', orderValue: 'tall'}}});
    assert.ok(!voidSmall.includes(Buffer.from([0x1D, 0x21, 0x22])), 'void follows the elements too');
});

test('retired composite orderHighlight migrates to orderLabel/orderValue', async () => {
    const {normalizeTicketLayout} = await import('../services/printing/printCommands.js');

    const migrated = normalizeTicketLayout({orderHighlight: 'medium'});
    assert.equal(migrated.orderLabel, 'tall');
    assert.equal(migrated.orderValue, 'medium');

    // explicit new values win over the old composite
    const explicit = normalizeTicketLayout({orderHighlight: 'small', orderLabel: 'huge', orderValue: 'huge'});
    assert.equal(explicit.orderLabel, 'huge');
    assert.equal(explicit.orderValue, 'huge');
});

test('orderItem size option changes the item line sizing', () => {
    const base = {headers: HEADERS, number: 1, tableNumber: '2A', items: [{quantity: 1, nameSnapshot: 'X'}]};

    const tall = buildOrderTicketJob({...base, profile: {layout: {orderItem: 'tall'}}});
    assert.ok(tall.includes(Buffer.from([0x1D, 0x21, 0x01])), 'GS ! 1x2 present');
    assert.ok(!tall.includes(Buffer.from([0x1D, 0x21, 0x10])), 'default 2x1 replaced');
});

test('extended size presets emit the expected GS ! bytes', async () => {
    const {renderItemTicketRaw} = await import('../services/printing/receiptRenderer.js');
    const {configurePrint, resetPrintSettings} = await import('../services/printing/printCommands.js');

    const expected = {wide: 0x10, mediumTall: 0x12, huge: 0x33};
    for (const [preset, byte] of Object.entries(expected)) {
        configurePrint({layout: {itemName: preset}});
        const buf = renderItemTicketRaw('Bifana');
        assert.ok(buf.includes(Buffer.from([0x1D, 0x21, byte])), `${preset} → GS ! 0x${byte.toString(16)}`);
    }
    resetPrintSettings();
});

test('unknown or legacy stored values fall back to the element default', async () => {
    const {configurePrint, layoutValue, resetPrintSettings} = await import('../services/printing/printCommands.js');
    // 'legacy' is what older installs may still have stored — it migrates to
    // the concrete default on read; unknown values do the same
    configurePrint({layout: {itemName: 'giant', totalsItem: 'legacy', orderHighlight: 'legacy'}});
    assert.equal(layoutValue('itemName'), 'mediumTall');
    assert.equal(layoutValue('totalsItem'), 'extraWide');
    assert.equal(layoutValue('orderLabel'), 'medium');
    assert.equal(layoutValue('orderValue'), 'big');
    resetPrintSettings();
});

// --- Zone split (one order ticket per product section) ---

test('groupItemsByZone splits per zone, sorted, no-zone group last', async () => {
    const {groupItemsByZone} = await import('../services/printing/zoneSplit.js');
    const zones = new Map([[1, 'Cozinha'], [2, 'Bar'], [3, null]]);
    const items = [
        {productId: 1, nameSnapshot: 'Bifana'},
        {productId: 2, nameSnapshot: 'Imperial'},
        {productId: 1, nameSnapshot: 'Borrego'},
        {productId: 3, nameSnapshot: 'Extra'},
        {productId: 99, nameSnapshot: 'Fantasma'}, // unknown product → no zone
    ];
    const groups = groupItemsByZone(items, zones);
    assert.deepEqual(groups.map((g) => g.zoneLabel), ['Bar', 'Cozinha', null]);
    assert.deepEqual(groups[0].items.map((i) => i.nameSnapshot), ['Imperial']);
    assert.deepEqual(groups[1].items.map((i) => i.nameSnapshot), ['Bifana', 'Borrego']);
    assert.deepEqual(groups[2].items.map((i) => i.nameSnapshot), ['Extra', 'Fantasma']);
});

test('zoneLabel prints an uppercase destination line, absent by default', () => {
    const base = {headers: HEADERS, number: 7, tableNumber: '3B', items: [{quantity: 1, nameSnapshot: 'X'}]};

    const plain = asText(buildOrderTicketJob(base));
    assert.doesNotMatch(plain, /COZINHA/);

    const labelled = asText(buildOrderTicketJob({...base, zoneLabel: 'Cozinha'}));
    assert.match(labelled, /COZINHA/);

    const voided = asText(buildOrderVoidJob({...base, zoneLabel: 'Bar'}));
    assert.match(voided, /BAR/);
});

test('orderZone layout option sets the destination line size (default medium 2x2)', () => {
    const base = {headers: HEADERS, number: 7, tableNumber: '3B', items: [{quantity: 1, nameSnapshot: 'X'}], zoneLabel: 'Bar'};

    const dflt = buildOrderTicketJob(base);
    const idx = asText(dflt).indexOf('» BAR');
    assert.ok(idx > 0, 'label present');
    // sequence before the label text: GS ! 0x11 (size 2x2) then ESC E 1 (bold)
    assert.deepEqual([...dflt.subarray(idx - 6, idx)], [0x1D, 0x21, 0x11, 0x1B, 0x45, 0x01]);

    const big = buildOrderTicketJob({...base, profile: {layout: {orderZone: 'big'}}});
    assert.ok(big.includes(Buffer.from([0x1D, 0x21, 0x22])), 'GS ! 3x3 when big');
});
