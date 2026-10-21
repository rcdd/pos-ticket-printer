import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'net';

import {bundlesFromProducts, expandTicketBundles, ticketFields} from '../services/printing/ticketBundles.js';
import {printTicketRequest} from '../services/printing/printService.js';

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

const METRO = {id: 7, name: 'Metro de Cerveja', ticketsPerUnit: 10, ticketLabel: 'Cerveja'};

test('bundlesFromProducts keeps only products with more than one ticket per unit', () => {
    const bundles = bundlesFromProducts([
        METRO,
        {id: 8, name: 'Bifana', ticketsPerUnit: 1, ticketLabel: null},
        {id: 9, name: 'Balde', ticketsPerUnit: 5, ticketLabel: ''},
    ]);
    assert.deepEqual([...bundles.keys()], [7, 9]);
    assert.deepEqual(bundles.get(7), {count: 10, label: 'Cerveja', name: 'Metro de Cerveja'});
    assert.equal(bundles.get(9).label, 'Balde'); // no label → the product name
});

test('expandTicketBundles: one numbered ticket per unit of the bundle, other lines untouched', () => {
    const bundles = bundlesFromProducts([{...METRO, ticketsPerUnit: 3}]);
    const lines = expandTicketBundles([
        {productId: 7, name: 'Metro de Cerveja'},
        {productId: 8, name: 'Bifana'},
        {productId: 7, name: 'Metro de Cerveja'},
    ], bundles);
    assert.deepEqual(lines.map((l) => l.subtitle ?? l.name), [
        'Metro de Cerveja 1/3', 'Metro de Cerveja 2/3', 'Metro de Cerveja 3/3',
        'Bifana',
        'Metro de Cerveja 1/3', 'Metro de Cerveja 2/3', 'Metro de Cerveja 3/3',
    ]);
    assert.ok(lines.filter((l) => l.bundle).every((l) => l.name === 'Cerveja'));
});

test('ticketFields clamps the count to 1..50 and turns an empty label into null', () => {
    assert.deepEqual(ticketFields({ticketsPerUnit: '10', ticketLabel: '  Cerveja '}), {ticketsPerUnit: 10, ticketLabel: 'Cerveja'});
    assert.deepEqual(ticketFields({ticketsPerUnit: 0, ticketLabel: ''}), {ticketsPerUnit: 1, ticketLabel: null});
    assert.deepEqual(ticketFields({ticketsPerUnit: 999}), {ticketsPerUnit: 50});
    assert.deepEqual(ticketFields({name: 'x'}), {});
});

const printSale = async (printType, bundles) => {
    const fake = await startFakePrinter();
    try {
        await printTicketRequest({
            printerName: {type: 'network', host: '127.0.0.1', port: fake.port},
            headers: {firstLine: 'Festa', secondLine: ''},
            items: [
                {id: 7, name: 'Metro de Cerveja', quantity: 1, price: 1000},
                {id: 8, name: 'Bifana', quantity: 1, price: 350},
            ],
            bundles,
            totalAmount: 1350,
            printType,
            openDrawer: false,
            isTest: false,
            profile: {headerPosition: 'top', cutMode: 'command', feedLines: 2, columns: 32},
        });
        await waitFor(() => fake.jobs.length === 1);
        return asText(fake.jobs[0]);
    } finally {
        fake.server.close();
    }
};

test('print type "totals": the bundle tickets still print, the other items do not', async () => {
    const text = await printSale('totals', bundlesFromProducts([{...METRO, ticketsPerUnit: 3}]));
    assert.equal(text.match(/1 Cerveja/g)?.length, 3);
    assert.match(text, /Metro de Cerveja 3\/3/);
    assert.match(text, /Pedido:/);                      // the receipt as usual
    assert.equal(text.match(/1 Bifana/g)?.length, 1);   // only its receipt line, no ticket
});

test('print type "tickets": bundle tickets plus one ticket per other item', async () => {
    const text = await printSale('tickets', bundlesFromProducts([{...METRO, ticketsPerUnit: 2}]));
    assert.equal(text.match(/1 Cerveja/g)?.length, 2);
    assert.equal(text.match(/1 Bifana/g)?.length, 1);   // its ticket ('tickets' prints no receipt)
    assert.doesNotMatch(text, /1 Metro de Cerveja/);
});

test('without bundles the sale prints as before', async () => {
    const text = await printSale('tickets', new Map());
    assert.match(text, /1 Metro de Cerveja/);
    assert.doesNotMatch(text, /1 Cerveja/);
});
