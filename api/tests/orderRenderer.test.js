import test from 'node:test';
import assert from 'node:assert/strict';
import {renderOrderTicketRaw, renderOrderVoidRaw, formatOrderNumber} from '../services/printing/orderRenderer.js';
import {buildOrderTicketJob, buildOrderVoidJob} from '../services/printing/printService.js';

// Os buffers ESC/POS misturam comandos binários com texto cp1252;
// para asserções chega procurar o texto (ASCII) dentro do buffer.
const asText = (buffer) => buffer.toString('latin1');
const FULL_CUT = Buffer.from([0x1B, 0x6D, 0x00]);
const HEADERS = {firstLine: 'Festa da Aldeia', secondLine: 'Comissao de Festas'};

test('formatOrderNumber preenche com zeros', () => {
    assert.equal(formatOrderNumber(7), '#007');
    assert.equal(formatOrderNumber(42), '#042');
    assert.equal(formatOrderNumber(1234), '#1234');
});

test('talão de mesa: MESA em destaque, nº do pedido só como referência pequena', () => {
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

test('talão avulso: nº gigante é a identidade do cliente', () => {
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

test('reimpressão marca 2ª via', () => {
    const text = asText(renderOrderTicketRaw({
        number: 5,
        tableNumber: '4A',
        items: [{quantity: 1, nameSnapshot: 'Bifana'}],
        reprint: true,
    }));
    assert.match(text, /2. VIA/); // "2ª" em cp1252
});

test('talão de anulação: itens negativos, mesa e aprovador', () => {
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

test('renderers não cortam papel — o corte pertence ao trabalho completo', () => {
    for (const buf of [
        renderOrderTicketRaw({number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]}),
        renderOrderVoidRaw({number: 1, tableNumber: '1A', items: [{quantity: 1, nameSnapshot: 'X'}]}),
    ]) {
        assert.ok(!buf.includes(FULL_CUT), 'o conteúdo não deve incluir corte');
    }
});

test('trabalho completo segue o esquema da casa: conteúdo → data → header + corte no fim', () => {
    for (const buf of [
        buildOrderTicketJob({headers: HEADERS, number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}]}),
        buildOrderVoidJob({headers: HEADERS, number: 9, tableNumber: '3A', items: [{quantity: 1, nameSnapshot: 'Sopa'}]}),
    ]) {
        const text = asText(buf);
        assert.match(text, /Festa da Aldeia/);
        assert.match(text, /Comissao de Festas/);
        assert.ok(buf.includes(FULL_CUT), 'o trabalho completo termina com corte');

        // o header (que vira o topo do talão seguinte) vem DEPOIS do conteúdo
        const contentIdx = text.indexOf('Sopa');
        const headerIdx = text.indexOf('Festa da Aldeia');
        const cutIdx = buf.indexOf(FULL_CUT);
        assert.ok(contentIdx < headerIdx, 'conteúdo antes do header');
        assert.ok(headerIdx < cutIdx || buf.lastIndexOf(FULL_CUT) > headerIdx, 'corte só após o header');
    }
});
