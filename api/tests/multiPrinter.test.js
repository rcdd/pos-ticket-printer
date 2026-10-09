import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'net';

import {planPrintGroups, MAIN_PRINTER_ID} from '../services/printing/zoneSplit.js';
import {validateExtraPrinter, normalizeExtraPrinters, normalizeRoutes} from '../services/printing/printerConfig.js';
import {sendRawTcp, probeTcp, localSubnets, discoverNetworkPrinters} from '../services/printing/networkPrinter.js';
import {renderOrderTicketRaw, renderPickupTicketRaw} from '../services/printing/orderRenderer.js';
import {printOrderTicket} from '../services/printing/printService.js';

const asText = (buffer) => buffer.toString('latin1');

// Fake LAN printer: collects every job received on a random local port.
const startFakePrinter = () => new Promise((resolve) => {
    const jobs = [];
    const server = net.createServer((socket) => {
        const chunks = [];
        socket.on('data', (c) => chunks.push(c));
        socket.on('end', () => jobs.push(Buffer.concat(chunks)));
    });
    server.listen(0, '127.0.0.1', () => resolve({server, jobs, port: server.address().port}));
});

const waitFor = async (predicate, ms = 1000) => {
    const until = Date.now() + ms;
    while (!predicate() && Date.now() < until) await new Promise((r) => setTimeout(r, 10));
};

// --- routing ---

const ZONES = new Map([
    [1, {id: 10, name: 'Restaurante'}],
    [2, {id: 20, name: 'Bar'}],
]);
const ITEMS = [
    {productId: 1, nameSnapshot: 'Bifana', quantity: 2},
    {productId: 2, nameSnapshot: 'Imperial', quantity: 1},
    {productId: 99, nameSnapshot: 'Sem zona', quantity: 1},
];

test('planPrintGroups: routed zone goes to its printer, the rest stays on main', () => {
    const groups = planPrintGroups(ITEMS, ZONES, {routes: {10: 'pK'}, split: true});
    assert.deepEqual(groups.map((g) => [g.zoneLabel, g.printerId]), [
        ['Bar', MAIN_PRINTER_ID],
        ['Restaurante', 'pK'],
        [null, MAIN_PRINTER_ID],
    ]);
});

test('planPrintGroups without split: one unlabelled ticket per printer, never mixing printers', () => {
    const groups = planPrintGroups(ITEMS, ZONES, {routes: {10: 'pK'}, split: false});
    assert.equal(groups.length, 2);
    const kitchen = groups.find((g) => g.printerId === 'pK');
    const main = groups.find((g) => g.printerId === MAIN_PRINTER_ID);
    assert.deepEqual(kitchen.items.map((i) => i.nameSnapshot), ['Bifana']);
    assert.deepEqual(main.items.map((i) => i.nameSnapshot), ['Imperial', 'Sem zona']);
    assert.ok(groups.every((g) => g.zoneLabel === null));
});

test('planPrintGroups without routes and without split = the historical single ticket', () => {
    const groups = planPrintGroups(ITEMS, ZONES, {split: false});
    assert.equal(groups.length, 1);
    assert.equal(groups[0].printerId, MAIN_PRINTER_ID);
    assert.equal(groups[0].items.length, 3);
});

// --- config validation ---

test('validateExtraPrinter: network printer normalized with its own profile', () => {
    const {printer, error} = validateExtraPrinter({
        name: '  Cozinha ',
        connection: {type: 'network', host: '192.168.1.50'},
        profile: {columns: 42, cutMode: 'auto', layout: {orderItem: 'big'}},
    }, {id: 'p1'});
    assert.equal(error, undefined);
    assert.equal(printer.name, 'Cozinha');
    assert.deepEqual(printer.connection, {type: 'network', host: '192.168.1.50', port: 9100});
    assert.equal(printer.profile.columns, 42);
    assert.equal(printer.profile.cutMode, 'auto');
    assert.equal(printer.profile.headerPosition, 'top');
    assert.equal(printer.profile.layout.orderItem, 'big');
    assert.equal(printer.profile.layout.orderValue, 'big'); // default kept
});

test('validateExtraPrinter: rejects missing name, bad host, bad columns', () => {
    assert.ok(validateExtraPrinter({connection: {type: 'network', host: '1.2.3.4'}}).error);
    assert.ok(validateExtraPrinter({name: 'X', connection: {type: 'network', host: 'bad host!'}}).error);
    assert.ok(validateExtraPrinter({name: 'X', connection: {type: 'system'}}).error);
    assert.ok(validateExtraPrinter({name: 'X', connection: {type: 'network', host: 'a.local'}, profile: {columns: 99}}).error);
    assert.equal(validateExtraPrinter({name: 'X', connection: {type: 'network', host: 'epson-tm.local'}}).error, undefined);
});

test('normalizeExtraPrinters drops invalid entries; normalizeRoutes drops routes to unknown printers', () => {
    const list = normalizeExtraPrinters([
        {id: 'p1', name: 'A', connection: {type: 'network', host: '10.0.0.5'}},
        {id: 'p2', name: '', connection: {type: 'network', host: '10.0.0.6'}},
        null,
        'garbage',
    ]);
    assert.deepEqual(list.map((p) => p.id), ['p1']);
    assert.deepEqual(normalizeRoutes({1: 'p1', 2: 'gone', x: 'p1'}, ['p1']), {1: 'p1'});
    assert.deepEqual(normalizeRoutes(null, ['p1']), {});
});

// --- network transport ---

test('sendRawTcp delivers the exact bytes to a LAN printer', async () => {
    const fake = await startFakePrinter();
    try {
        const payload = Buffer.from([0x1B, 0x40, 0x41, 0x42, 0x0A]);
        await sendRawTcp({host: '127.0.0.1', port: fake.port}, payload);
        await waitFor(() => fake.jobs.length === 1);
        assert.deepEqual(fake.jobs[0], payload);
    } finally {
        fake.server.close();
    }
});

test('sendRawTcp rejects quickly when nothing listens', async () => {
    const fake = await startFakePrinter();
    const {port} = fake;
    await new Promise((r) => fake.server.close(r));
    await assert.rejects(sendRawTcp({host: '127.0.0.1', port}, Buffer.from('x')), /inacess/);
});

test('printOrderTicket with a network target uses that printer and its profile', async () => {
    const fake = await startFakePrinter();
    try {
        await printOrderTicket({
            printerName: {type: 'network', host: '127.0.0.1', port: fake.port},
            headers: {firstLine: 'Festa', secondLine: ''},
            profile: {headerPosition: 'top', cutMode: 'command', feedLines: 2, columns: 32},
            number: 5,
            tableNumber: '4A',
            items: [{quantity: 2, nameSnapshot: 'Bifana'}],
            zoneLabel: 'Restaurante',
        });
        await waitFor(() => fake.jobs.length === 1);
        const text = asText(fake.jobs[0]);
        assert.match(text, /Bifana/);
        assert.match(text, /RESTAURANTE/);
        assert.match(text, /_{32}\n/); // 32-column separator from ITS profile
        assert.doesNotMatch(text, /_{33}/);
    } finally {
        fake.server.close();
    }
});

test('probeTcp: true for an open port, false for a closed one', async () => {
    const fake = await startFakePrinter();
    assert.equal(await probeTcp('127.0.0.1', fake.port, 500), true);
    await new Promise((r) => fake.server.close(r));
    assert.equal(await probeTcp('127.0.0.1', fake.port, 500), false);
});

test('localSubnets: external IPv4 /24 only (no loopback, no link-local, no IPv6)', () => {
    const subnets = localSubnets({
        lo: [{family: 'IPv4', address: '127.0.0.1', internal: true}],
        eth0: [
            {family: 'IPv4', address: '192.168.1.20', internal: false},
            {family: 'IPv6', address: 'fe80::1', internal: false},
        ],
        wifi: [{family: 'IPv4', address: '169.254.3.3', internal: false}],
    });
    assert.deepEqual(subnets, [{prefix: '192.168.1', ownAddress: '192.168.1.20'}]);
});

test('discoverNetworkPrinters finds a host with the printing port open', async () => {
    const fake = await startFakePrinter();
    try {
        const found = await discoverNetworkPrinters({
            port: fake.port,
            timeoutMs: 200,
            subnets: [{prefix: '127.0.0', ownAddress: '127.0.0.2'}],
        });
        assert.ok(found.some((f) => f.host === '127.0.0.1' && f.port === fake.port), JSON.stringify(found));
    } finally {
        fake.server.close();
    }
});

// --- tickets ---

test('fallback notice tells staff to carry the ticket to its station', () => {
    const text = asText(renderOrderTicketRaw({
        number: 3, items: [{quantity: 1, nameSnapshot: 'Bifana'}], zoneLabel: 'Restaurante', fallbackFrom: 'Cozinha',
    }));
    assert.match(text, /IMPRESSORA COZINHA FALHOU/);
    assert.match(text, /RESTAURANTE/);
    assert.doesNotMatch(asText(renderOrderTicketRaw({number: 3, items: []})), /FALHOU/);
});

test('pickup ticket: order number, where to collect and the items', () => {
    const text = asText(renderPickupTicketRaw({
        number: 57,
        items: [{quantity: 2, name: 'Bifana'}],
        zoneLabel: 'Restaurante',
    }));
    assert.match(text, /PEDIDO/);
    assert.match(text, /#057/);
    assert.match(text, /Levantar em:/);
    assert.match(text, /RESTAURANTE/);
    assert.match(text, /2x Bifana/);
});

// --- per-printer header ---

test('validateHeader: main by default, custom needs a line, none allowed', async () => {
    const {validateHeader} = await import('../services/printing/printerConfig.js');
    assert.deepEqual(validateHeader(undefined).header, {mode: 'main', firstLine: '', secondLine: ''});
    assert.ok(validateHeader({mode: 'custom'}).error);
    assert.deepEqual(validateHeader({mode: 'custom', firstLine: ' COZINHA '}).header,
        {mode: 'custom', firstLine: 'COZINHA', secondLine: ''});
    assert.equal(validateHeader({mode: 'none', firstLine: 'kept'}).header.firstLine, 'kept');
    assert.ok(validateHeader({mode: 'weird'}).error);
    assert.ok(validateHeader({mode: 'custom', firstLine: 'x'.repeat(41)}).error);
});

test('resolveHeader: main lines, own lines or nothing', async () => {
    const {resolveHeader} = await import('../services/printing/printerConfig.js');
    const main = {firstLine: 'Festa', secondLine: 'Comissao'};
    assert.deepEqual(resolveHeader({mode: 'main'}, main), main);
    assert.deepEqual(resolveHeader(undefined, main), main);
    assert.deepEqual(resolveHeader({mode: 'custom', firstLine: 'COZINHA', secondLine: ''}, main),
        {firstLine: 'COZINHA', secondLine: null});
    assert.deepEqual(resolveHeader({mode: 'none', firstLine: 'COZINHA'}, main), {firstLine: null, secondLine: null});
});

test('a printer without header prints neither header lines nor the separator', async () => {
    const {buildOrderTicketJob} = await import('../services/printing/printService.js');
    const base = {number: 1, items: [{quantity: 1, nameSnapshot: 'Bifana'}], profile: {headerPosition: 'top', columns: 32}};
    const withHeader = asText(buildOrderTicketJob({...base, headers: {firstLine: 'COZINHA', secondLine: null}}));
    const without = asText(buildOrderTicketJob({...base, headers: {firstLine: null, secondLine: null}}));
    assert.match(withHeader, /COZINHA/);
    const separators = (text) => (text.match(/_{32}\n/g) ?? []).length;
    assert.equal(separators(without), separators(withHeader) - 1);
    assert.match(without, /Bifana/);
});
