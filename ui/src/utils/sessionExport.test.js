import {buildSessionExport} from "./sessionExport";

const bar = {id: 1, name: 'Bar'};
const imperial = {id: 10, name: 'Imperial', price: 110, zone: bar};
const metro = {id: 11, name: 'Metro', price: 1000, zone: bar};

const sessions = [
    {id: 2, openedAt: '2026-10-11T10:00:00Z', closedAt: '2026-10-11T23:00:00Z', initialAmount: 5000, userOpenId: 1, userCloseId: 1},
    {id: 1, openedAt: '2026-10-10T10:00:00Z', closedAt: '2026-10-10T23:00:00Z', initialAmount: 5000, userOpenId: 1, userCloseId: 2},
];

const invoices = [
    // session 1: cash sale, split sale, revoked sale
    {id: 100, sessionId: 1, total: 220, paymentMethod: 'cash', userId: 1, createdAt: '2026-10-10T12:00:00Z',
        records: [{quantity: 2, price: 110, productItem: imperial}]},
    {id: 101, sessionId: 1, total: 1000, paymentMethod: 'cash', userId: 2, createdAt: '2026-10-10T13:00:00Z',
        payments: [{method: 'cash', amount: 400}, {method: 'card', amount: 600}],
        orders: [{number: 7, table: {number: '12'}}],
        records: [{quantity: 1, price: 1000, productItem: metro}]},
    {id: 102, sessionId: 1, total: 110, paymentMethod: 'mbway', isDeleted: true, userId: 1, createdAt: '2026-10-10T14:00:00Z',
        records: [{quantity: 1, price: 110, productItem: imperial}]},
    // session 2: discounted sale + a menu
    {id: 200, sessionId: 2, total: 99, paymentMethod: 'mbway', discountPercent: 10, discountNote: 'Banda', userId: 1, createdAt: '2026-10-11T12:00:00Z',
        records: [{quantity: 1, price: 110, productItem: imperial}]},
    {id: 201, sessionId: 2, total: 1200, paymentMethod: 'cash', userId: 1, createdAt: '2026-10-11T13:00:00Z',
        records: [{quantity: 1, price: 1200, menuItem: {id: 5, name: 'Menu Almoço'}}]},
];

const movementsBySession = new Map([
    [1, [{type: 'CASH_IN', amount: 1000, reason: 'Trocos', createdAt: '2026-10-10T11:00:00Z', user: {name: 'Ana'}},
        {type: 'CASH_OUT', amount: 300, reason: 'Gelo', createdAt: '2026-10-10T15:00:00Z', user: {name: 'Ana'}}]],
]);

const ordersBySession = new Map([
    [1, [{number: 7, status: 'paid', userId: 3, user: {name: 'João'}, table: {displayName: '12A'},
        items: [
            {status: 'active', nameSnapshot: 'Metro', quantity: 1, price: 1000},
            {status: 'cancelled', nameSnapshot: 'Imperial', quantity: 2, price: 110, cancelledById: 3, cancelledAt: '2026-10-10T12:30:00Z'},
        ]}]],
]);

const names = {1: 'Ana', 2: 'Rui', 3: 'João'};
const userName = (id) => names[id] ?? '';

const build = (overrides = {}) => buildSessionExport({
    sessions, invoices, movementsBySession, ordersBySession, userName, ...overrides,
});

test('summary: one row per session in chronological order, same totals as the session ticket, plus a TOTAL row', () => {
    const {summary} = build();
    expect(summary.map((r) => r.session)).toEqual([1, 2, 'TOTAL']);

    const s1 = summary[0];
    expect(s1.total).toBe(12.2);          // revoked invoice left out
    expect(s1.cash).toBe(6.2);            // 2,20 + 4,00 (cash parcel of the split)
    expect(s1.card).toBe(6);
    expect(s1.mbway).toBe(0);
    expect(s1.operations).toBe(3);
    expect(s1.revoked).toBe(1);
    expect(s1.cashIn).toBe(10);
    expect(s1.cashOut).toBe(3);
    expect(s1.finalCash).toBe(63.2);
    expect(s1.closedBy).toBe('Rui');

    const total = summary[2];
    expect(total.total).toBe(25.19);
    expect(total.operations).toBe(5);
});

test('products: per session, menus included, revoked invoices excluded, discounted lines apart', () => {
    const {products, productsTotal} = build();
    const s1 = products.filter((p) => p.session === 1);
    expect(s1).toEqual([
        expect.objectContaining({name: 'Imperial', quantity: 2, total: 2.2, discount: 0}),
        expect.objectContaining({name: 'Metro', quantity: 1, total: 10}),
    ]);
    const s2 = products.filter((p) => p.session === 2);
    expect(s2).toEqual(expect.arrayContaining([
        expect.objectContaining({name: 'Imperial', discount: 10, note: 'Banda', total: 0.99}),
        expect.objectContaining({name: 'Menu Almoço', kind: 'Menu', zone: 'Menus', total: 12}),
    ]));
    // across sessions: Imperial full price and Imperial -10% stay separate
    expect(productsTotal.filter((p) => p.name === 'Imperial')).toHaveLength(2);
});

test('invoices: every invoice with origin, split parcels per method and status', () => {
    const {invoices: rows} = build();
    expect(rows).toHaveLength(5);
    const split = rows.find((r) => r.invoice === 101);
    expect(split).toMatchObject({origin: 'Pedido #007 · Mesa 12', cash: 4, card: 6, user: 'Rui', status: 'Válida'});
    expect(rows.find((r) => r.invoice === 100).origin).toBe('Venda direta');
    expect(rows.find((r) => r.invoice === 100).note).toBe('');
    expect(rows.find((r) => r.invoice === 200)).toMatchObject({discount: 10, note: 'Banda'});
    expect(rows.find((r) => r.invoice === 102).status).toBe('Anulada');
});

test('cash movements: cash out as a negative amount', () => {
    const {movements} = build();
    expect(movements.map((m) => [m.type, m.amount])).toEqual([['Entrada', 10], ['Saída', -3]]);
});

test('voids: who voided what, before payment', () => {
    const {voids} = build();
    expect(voids).toEqual([expect.objectContaining({
        session: 1, order: '#007', table: '12A', name: 'Imperial', quantity: 2, amount: 2.2,
        orderedBy: 'João', cancelledBy: 'João', wholeOrder: 'Não',
    })]);
});

test('voids sheet: present with multi-terminal on (even empty) or when there are voids; absent otherwise', () => {
    expect(build({ordersBySession: new Map(), includeVoids: true}).voids).toEqual([]);
    expect(build({ordersBySession: new Map(), includeVoids: false}).voids).toBeNull();
    expect(build({includeVoids: false}).voids).toHaveLength(1);
});

test('a single session: no TOTAL row and no cross-session products sheet', () => {
    const one = build({sessions: [sessions[1]]});
    expect(one.summary).toHaveLength(1);
    expect(one.productsTotal).toBeNull();
});
