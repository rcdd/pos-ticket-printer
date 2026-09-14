import test from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';

// Dedicated test database — never touch the dev ptp_db.
process.env.DB_NAME = 'ptp_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const MULTI_TOKEN = 'DEMO-NR8-1-DEHJF2'; // fixture: secret PTP-TEST-CODE, expires 2031-01-01, multi
const INSTALLATION_CODE = 'PTP-TEST-CODE';

const canConnect = async () => {
    try {
        const mysql = await import('mysql2/promise');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectTimeout: 3000,
        });
        await conn.query('CREATE DATABASE IF NOT EXISTS ptp_test');
        await conn.end();
        return true;
    } catch {
        return false;
    }
};

test('orders and tables API (integration)', async (t) => {
    if (!(await canConnect())) {
        t.skip('Test MySQL unavailable (start the mysqldb container).');
        return;
    }

    const {default: request} = await import('supertest');
    const {default: app} = await import('../../app.js');
    const {default: db} = await import('../../db/index.js');
    const {initLicenseState} = await import('../../services/license.service.js');

    await db.sequelize.sync({force: true});

    // Multi-terminal license: pin the installation code and apply the test token
    await db.options.create({name: 'license_installation_code', value: INSTALLATION_CODE});
    await initLicenseState();
    const licenseRes = await request(app).post('/license/apply').send({code: MULTI_TOKEN});
    assert.equal(licenseRes.status, 200, JSON.stringify(licenseRes.body));
    assert.equal(licenseRes.body.features.multi, true);

    // First user (admin) + one waiter
    const adminCreate = await request(app).post('/user/add')
        .send({username: 'chefe', password: 'segredo123', role: 'admin', name: 'Chefe'});
    assert.equal(adminCreate.status, 201, JSON.stringify(adminCreate.body));

    const adminLogin = await request(app).post('/user/login')
        .send({username: 'chefe', password: 'segredo123'});
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.body.token;
    const authAdmin = (req) => req.set('Authorization', `Bearer ${adminToken}`);

    const waiterCreate = await authAdmin(request(app).post('/user/add'))
        .send({username: 'joao', password: 'segredo123', role: 'waiter', name: 'João'});
    assert.equal(waiterCreate.status, 201, JSON.stringify(waiterCreate.body));

    const waiterLogin = await request(app).post('/user/login')
        .send({username: 'joao', password: 'segredo123'});
    const waiterToken = waiterLogin.body.token;
    const authWaiter = (req) => req.set('Authorization', `Bearer ${waiterToken}`);

    // Test products and menu (straight into the DB — not what these tests target)
    const zone = await db.zones.create({name: 'Bar'});
    const beer = await db.products.create({name: 'Imperial', price: 150, zoneId: zone.id});
    const dish = await db.products.create({name: 'Francesinha', price: 950, zoneId: zone.id});
    const menu = await db.menus.create({name: 'Menu Almoço', price: 1200});

    await t.test('multi-terminal off by default: creating an order gives 403', async () => {
        const res = await authWaiter(request(app).post('/order'))
            .send({items: [{productId: beer.id, quantity: 1}]});
        assert.equal(res.status, 403);
    });

    await t.test('only admin can enable multi-terminal', async () => {
        const forbidden = await authWaiter(request(app).post('/option/multi-terminal')).send({enabled: true});
        assert.equal(forbidden.status, 403);

        const ok = await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: true});
        assert.equal(ok.status, 200);
        assert.equal(ok.body.enabled, true);
    });

    await t.test('no open register session: creating an order gives 409', async () => {
        const res = await authWaiter(request(app).post('/order'))
            .send({items: [{productId: beer.id, quantity: 1}]});
        assert.equal(res.status, 409);
    });

    const adminUser = adminLogin.body.user;
    const sessionRes = await authAdmin(request(app).post('/session/start'))
        .send({userId: adminUser.id, initialAmount: 5000});
    assert.equal(sessionRes.status, 200, JSON.stringify(sessionRes.body));
    const sessionId = sessionRes.body.id;

    let firstOrderId = null;

    await t.test('standalone order: created, numbered and totalled server-side', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'req-0001',
            note: 'sem espuma',
            items: [
                {productId: beer.id, quantity: 2},
                {menuId: menu.id, quantity: 1},
                // client-sent price is ignored
                {productId: dish.id, quantity: 1, price: 1},
            ],
        });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const {order, duplicate} = res.body;
        assert.equal(duplicate, false);
        assert.equal(order.number, 1);
        assert.equal(order.status, 'sent');
        assert.equal(order.tableId, null);
        assert.equal(order.total, 2 * 150 + 1200 + 950);
        assert.equal(order.items.length, 3);
        assert.equal(order.items.find((i) => i.menuId === menu.id).nameSnapshot, 'Menu Almoço');
        firstOrderId = order.id;
    });

    await t.test('retry with the same clientRequestId does not duplicate', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'req-0001',
            items: [{productId: beer.id, quantity: 2}],
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.duplicate, true);
        assert.equal(res.body.order.id, firstOrderId);
    });

    await t.test('invalid items are rejected with 400', async () => {
        for (const items of [
            [],
            [{quantity: 1}],
            [{productId: beer.id, menuId: menu.id, quantity: 1}],
            [{productId: beer.id, quantity: 0}],
            [{productId: 99999, quantity: 1}],
        ]) {
            const res = await authWaiter(request(app).post('/order')).send({items});
            assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(items)}`);
        }
    });

    let tableId = null;

    let secondGroupId = null;

    await t.test('tables: physical number + group letter; same table creates a new group', async () => {
        const auto = await authWaiter(request(app).post('/table')).send({});
        assert.equal(auto.status, 201);
        assert.equal(auto.body.number, '1');
        assert.equal(auto.body.letter, 'A');
        assert.equal(auto.body.displayName, '1A');

        const named = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(named.status, 201);
        assert.equal(named.body.displayName, '12A');
        tableId = named.body.id;

        // second group at the same physical table → next letter, no conflict
        const second = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(second.status, 201);
        assert.equal(second.body.letter, 'B');
        assert.equal(second.body.displayName, '12B');
        secondGroupId = second.body.id;

        // lookup by physical number returns the groups sorted
        const byNumber = await authWaiter(request(app).get('/tables/by-number/12'));
        assert.equal(byNumber.status, 200);
        assert.equal(byNumber.body.number, '12');
        assert.deepEqual(byNumber.body.tabs.map((tab) => tab.displayName), ['12A', '12B']);
        // traceability: who opened the tab comes in the response
        assert.equal(byNumber.body.tabs[0].openedBy.username, 'joao');

        // close group B (empty) right away so it doesn't interfere with later tests
        const closed = await authWaiter(request(app).post(`/table/${secondGroupId}/close-empty`));
        assert.equal(closed.status, 200);
    });

    await t.test('order attached to a table accrues on the unpaid total', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            tableId,
            items: [{productId: dish.id, quantity: 2}],
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.order.number, 2);

        const tableRes = await authWaiter(request(app).get(`/table/${tableId}`));
        assert.equal(tableRes.status, 200);
        assert.equal(tableRes.body.unpaidTotal, 2 * 950);
        assert.equal(tableRes.body.orders.length, 1);

        const listRes = await authWaiter(request(app).get('/tables'));
        const row = listRes.body.find((tbl) => tbl.id === tableId);
        assert.equal(row.unpaidTotal, 2 * 950);
        assert.equal(row.openOrders, 1);
    });

    await t.test('order for a missing/closed table gives 400', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            tableId: 9999,
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 400);
    });

    await t.test('listing and lookup by number', async () => {
        const list = await authWaiter(request(app).get('/orders?status=sent'));
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 2);

        const byNumber = await authWaiter(request(app).get('/order/by-number/2'));
        assert.equal(byNumber.status, 200);
        assert.equal(byNumber.body.tableId, tableId);

        const missing = await authWaiter(request(app).get('/order/by-number/99'));
        assert.equal(missing.status, 404);
    });

    await t.test('concurrent creations get distinct numbers', async () => {
        const results = await Promise.all(Array.from({length: 5}, (_, i) =>
            authWaiter(request(app).post('/order')).send({
                clientRequestId: `conc-${i}`,
                items: [{productId: beer.id, quantity: 1}],
            })
        ));
        const numbers = results.map((r) => {
            assert.equal(r.status, 201, JSON.stringify(r.body));
            return r.body.order.number;
        });
        assert.equal(new Set(numbers).size, numbers.length, `duplicate numbers: ${numbers}`);
    });

    await t.test('closing a table: 409 with unpaid orders, empty one closes', async () => {
        const blocked = await authWaiter(request(app).post(`/table/${tableId}/close-empty`));
        assert.equal(blocked.status, 409);

        const emptyTable = await authWaiter(request(app).post('/table')).send({number: '7'});
        const closed = await authWaiter(request(app).post(`/table/${emptyTable.body.id}/close-empty`));
        assert.equal(closed.status, 200);
        assert.equal(closed.body.status, 'closed');
    });

    await t.test('table number must be numeric; leading zeros normalize', async () => {
        for (const bad of ['Esplanada', '12B', '0', '-3', '10000']) {
            const res = await authWaiter(request(app).post('/table')).send({number: bad});
            assert.equal(res.status, 400, `expected 400 for "${bad}"`);
        }
        const badLookup = await authWaiter(request(app).get('/tables/by-number/abc'));
        assert.equal(badLookup.status, 400);

        // "012" and "12" are the same physical table
        const padded = await authWaiter(request(app).post('/table')).send({number: '012'});
        assert.equal(padded.status, 201);
        assert.equal(padded.body.number, '12');
        await authWaiter(request(app).post(`/table/${padded.body.id}/close-empty`));
    });

    await t.test('/system/info: admin sees multi status, waiter has no access', async () => {
        const forbidden = await authWaiter(request(app).get('/system/info'));
        assert.equal(forbidden.status, 403);

        const info = await authAdmin(request(app).get('/system/info'));
        assert.equal(info.status, 200);
        assert.equal(info.body.mode, 'multi');
        assert.deepEqual(info.body.multiTerminal, {licensed: true, enabled: true, effective: true});
        assert.equal(info.body.port, Number(process.env.NODE_DOCKER_PORT || 9393));
    });

    await t.test('no printer configured: order still created, printed=false', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'print-1',
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.printed, false);
        assert.equal(res.body.printError, 'Impressora não configurada.');
        assert.equal(res.body.order.printedAt, null);
    });

    await t.test('invalid printer: order still created, with printError', async () => {
        await db.options.create({name: 'printer', value: 'ImpressoraFantasma'});

        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'print-2',
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.printed, false);
        assert.ok(res.body.printError, 'expected a print error message');
        assert.equal(res.body.order.printedAt, null);
    });

    await t.test('reprint: 404 for a missing order, best-effort for an existing one', async () => {
        const missing = await authWaiter(request(app).post('/order/99999/reprint'));
        assert.equal(missing.status, 404);

        const res = await authWaiter(request(app).post(`/order/${firstOrderId}/reprint`));
        assert.equal(res.status, 200);
        assert.equal(res.body.printed, false); // no real printer in tests
        assert.ok(res.body.printError);
    });

    await t.test('disabling multi-terminal blocks creation again (but not reads)', async () => {
        await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: false});

        const blocked = await authWaiter(request(app).post('/order'))
            .send({items: [{productId: beer.id, quantity: 1}]});
        assert.equal(blocked.status, 403);

        const list = await authWaiter(request(app).get('/orders'));
        assert.equal(list.status, 200);

        await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: true});
    });

    await t.test('paying an order: waiter cannot; admin pays with discount and creates an invoice', async () => {
        const forbidden = await authWaiter(request(app).post(`/order/${firstOrderId}/pay`))
            .send({paymentMethod: 'cash'});
        assert.equal(forbidden.status, 403);

        const res = await authAdmin(request(app).post(`/order/${firstOrderId}/pay`))
            .send({paymentMethod: 'card', discount: 10});
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.ok(res.body.invoiceId);
        assert.equal(res.body.total, Math.round(2450 * 0.9));
        assert.equal(res.body.order.status, 'paid');
        assert.equal(res.body.order.invoiceId, res.body.invoiceId);

        const invoice = await db.invoices.findByPk(res.body.invoiceId, {include: [db.records]});
        assert.equal(invoice.total, Math.round(2450 * 0.9));
        assert.equal(invoice.paymentMethod, 'card');
        assert.equal(invoice.discountPercent, 10);
        assert.equal(invoice.records.length, 3);

        const again = await authAdmin(request(app).post(`/order/${firstOrderId}/pay`))
            .send({paymentMethod: 'cash'});
        assert.equal(again.status, 409);
    });

    await t.test('paying a table: single invoice, orders paid, table closed', async () => {
        const res = await authAdmin(request(app).post(`/table/${tableId}/pay`))
            .send({paymentMethod: 'cash'});
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.ok(res.body.invoiceId);
        assert.equal(res.body.total, 2 * 950);
        assert.equal(res.body.orderCount, 1);

        const tableRow = await db.tables.findByPk(tableId);
        assert.equal(tableRow.status, 'closed');

        const tableOrders = await db.orders.findAll({where: {tableId}});
        assert.ok(tableOrders.every((order) => order.status === 'paid'));

        const openTables = await authAdmin(request(app).get('/tables'));
        assert.ok(!openTables.body.some((tbl) => tbl.id === tableId));

        // letter reuse: 12A closed, the next group at table 12 becomes A again
        const reopened = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(reopened.status, 201);
        assert.equal(reopened.body.displayName, '12A');
        await authWaiter(request(app).post(`/table/${reopened.body.id}/close-empty`));
    });

    await t.test('item cancellation: requires admin approval and recomputes the total', async () => {
        const created = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'cancel-1',
            items: [
                {productId: beer.id, quantity: 2},
                {productId: dish.id, quantity: 1},
            ],
        });
        assert.equal(created.status, 201);
        const order = created.body.order;
        const beerItem = order.items.find((i) => i.productId === beer.id);
        const dishItem = order.items.find((i) => i.productId === dish.id);

        // no credentials and not an admin → 401
        const noCreds = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id]});
        assert.equal(noCreds.status, 401);

        // wrong credentials → 401
        const badCreds = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'chefe', adminPassword: 'errada'});
        assert.equal(badCreds.status, 401);

        // non-admin credentials → 403
        const notAdmin = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'joao', adminPassword: 'segredo123'});
        assert.equal(notAdmin.status, 403);

        // approved by the admin → item cancelled, total recomputed, audit fields filled
        const ok = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'chefe', adminPassword: 'segredo123'});
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        assert.equal(ok.body.fullyCancelled, false);
        assert.equal(ok.body.order.total, 950);
        const cancelledItem = ok.body.order.items.find((i) => i.id === beerItem.id);
        assert.equal(cancelledItem.status, 'cancelled');
        assert.equal(cancelledItem.cancelledById, adminUser.id);
        assert.ok(cancelledItem.cancelledAt);

        // an authenticated admin needs no credentials; cancelling everything cancels the order
        const rest = await authAdmin(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [dishItem.id]});
        assert.equal(rest.status, 200);
        assert.equal(rest.body.fullyCancelled, true);
        assert.equal(rest.body.order.status, 'cancelled');
        assert.equal(rest.body.order.total, 0);

        // a cancelled order can be neither paid nor re-cancelled
        const payCancelled = await authAdmin(request(app).post(`/order/${order.id}/pay`))
            .send({paymentMethod: 'cash'});
        assert.equal(payCancelled.status, 409);
        const cancelAgain = await authAdmin(request(app).post(`/order/${order.id}/cancel-items`))
            .send({all: true});
        assert.equal(cancelAgain.status, 409);
    });

    await t.test('cancel everything with all:true; refuse on paid orders', async () => {
        const paid = await authAdmin(request(app).post(`/order/${firstOrderId}/cancel-items`))
            .send({all: true});
        assert.equal(paid.status, 409);

        const created = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'cancel-2',
            items: [{productId: beer.id, quantity: 1}],
        });
        const all = await authAdmin(request(app).post(`/order/${created.body.order.id}/cancel-items`))
            .send({all: true});
        assert.equal(all.status, 200);
        assert.equal(all.body.fullyCancelled, true);
    });

    await t.test('SSE /events: requires a token and delivers events in realtime', async () => {
        const noToken = await request(app).get('/events');
        assert.equal(noToken.status, 401);

        const {emitEvent} = await import('../../services/events.service.js');
        const http = await import('node:http');

        const server = app.listen(0);
        try {
            const port = server.address().port;
            const chunks = [];
            const req = http.get(
                `http://127.0.0.1:${port}/events?token=${encodeURIComponent(waiterToken)}`,
                (res) => {
                    assert.equal(res.statusCode, 200);
                    assert.match(res.headers['content-type'], /text\/event-stream/);
                    res.on('data', (chunk) => chunks.push(chunk.toString()));
                },
            );

            await new Promise((resolve) => setTimeout(resolve, 250));
            emitEvent('order.created', {orderId: 123, number: 9});
            await new Promise((resolve) => setTimeout(resolve, 250));

            const stream = chunks.join('');
            assert.match(stream, /event: hello/);
            assert.match(stream, /event: order\.created/);
            assert.match(stream, /"orderId":123/);

            req.destroy();
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    await t.test('login rate limit: 6th failed attempt gives 429', async () => {
        for (let i = 0; i < 5; i += 1) {
            const res = await request(app).post('/user/login')
                .send({username: 'atacante', password: `errada-${i}`});
            assert.equal(res.status, 404); // user does not exist
        }
        const blocked = await request(app).post('/user/login')
            .send({username: 'atacante', password: 'errada-6'});
        assert.equal(blocked.status, 429);
        assert.ok(blocked.headers['retry-after']);

        // other users are unaffected (key is IP+username)
        const ok = await request(app).post('/user/login')
            .send({username: 'joao', password: 'segredo123'});
        assert.equal(ok.status, 200);
    });

    await t.test('session close: blocks with pending orders; force cancels them and closes tables', async () => {
        const pendingBefore = await db.orders.count({where: {sessionId, status: 'sent'}});
        const cancelledBefore = await db.orders.count({where: {sessionId, status: 'cancelled'}});
        assert.ok(pendingBefore > 0, 'there should be unpaid orders at this point');

        const blocked = await authAdmin(request(app).post(`/session/close/${sessionId}`))
            .send({userId: adminUser.id, finalAmount: 9000});
        assert.equal(blocked.status, 409);
        assert.equal(blocked.body.pendingOrders, pendingBefore);

        const forced = await authAdmin(request(app).post(`/session/close/${sessionId}`))
            .send({userId: adminUser.id, finalAmount: 9000, force: true});
        assert.equal(forced.status, 200, JSON.stringify(forced.body));

        const pendingAfter = await db.orders.count({where: {sessionId, status: 'sent'}});
        assert.equal(pendingAfter, 0);
        const cancelled = await db.orders.count({where: {sessionId, status: 'cancelled'}});
        assert.equal(cancelled - cancelledBefore, pendingBefore);

        const openTables = await db.tables.count({where: {sessionId, status: 'open'}});
        assert.equal(openTables, 0);

        const active = await authAdmin(request(app).get('/session/active'));
        assert.equal(active.status, 404);
    });

    assert.ok(sessionId, 'test session created');

    await db.sequelize.close();
});
