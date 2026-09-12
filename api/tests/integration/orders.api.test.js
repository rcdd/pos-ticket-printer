import test from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';

// Base de dados dedicada aos testes — nunca tocar na ptp_db de dev.
process.env.DB_NAME = 'ptp_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const MULTI_TOKEN = 'DEMO-NR8-1-DEHJF2'; // fixture: secret PTP-TEST-CODE, expira 2031-01-01, multi
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

test('API de pedidos e mesas (integração)', async (t) => {
    if (!(await canConnect())) {
        t.skip('MySQL de teste indisponível (arranque o container mysqldb).');
        return;
    }

    const {default: request} = await import('supertest');
    const {default: app} = await import('../../app.js');
    const {default: db} = await import('../../db/index.js');
    const {initLicenseState} = await import('../../services/license.service.js');

    await db.sequelize.sync({force: true});

    // Licença multiposto: fixa o installation code e aplica o token de teste
    await db.options.create({name: 'license_installation_code', value: INSTALLATION_CODE});
    await initLicenseState();
    const licenseRes = await request(app).post('/license/apply').send({code: MULTI_TOKEN});
    assert.equal(licenseRes.status, 200, JSON.stringify(licenseRes.body));
    assert.equal(licenseRes.body.features.multi, true);

    // Primeiro utilizador (admin) + um empregado
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

    // Produtos e menu de teste (diretos à BD — não é o alvo destes testes)
    const zone = await db.zones.create({name: 'Bar'});
    const beer = await db.products.create({name: 'Imperial', price: 150, zoneId: zone.id});
    const dish = await db.products.create({name: 'Francesinha', price: 950, zoneId: zone.id});
    const menu = await db.menus.create({name: 'Menu Almoço', price: 1200});

    await t.test('multiposto desligado por omissão: criar pedido dá 403', async () => {
        const res = await authWaiter(request(app).post('/order'))
            .send({items: [{productId: beer.id, quantity: 1}]});
        assert.equal(res.status, 403);
    });

    await t.test('só admin liga o multiposto', async () => {
        const forbidden = await authWaiter(request(app).post('/option/multi-terminal')).send({enabled: true});
        assert.equal(forbidden.status, 403);

        const ok = await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: true});
        assert.equal(ok.status, 200);
        assert.equal(ok.body.enabled, true);
    });

    await t.test('sem sessão de caixa aberta: criar pedido dá 409', async () => {
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

    await t.test('pedido avulso: cria, numera e calcula total no servidor', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'req-0001',
            note: 'sem espuma',
            items: [
                {productId: beer.id, quantity: 2},
                {menuId: menu.id, quantity: 1},
                // preço enviado pelo cliente é ignorado
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

    await t.test('retry com o mesmo clientRequestId não duplica', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'req-0001',
            items: [{productId: beer.id, quantity: 2}],
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.duplicate, true);
        assert.equal(res.body.order.id, firstOrderId);
    });

    await t.test('itens inválidos são rejeitados com 400', async () => {
        for (const items of [
            [],
            [{quantity: 1}],
            [{productId: beer.id, menuId: menu.id, quantity: 1}],
            [{productId: beer.id, quantity: 0}],
            [{productId: 99999, quantity: 1}],
        ]) {
            const res = await authWaiter(request(app).post('/order')).send({items});
            assert.equal(res.status, 400, `esperava 400 para ${JSON.stringify(items)}`);
        }
    });

    let tableId = null;

    let secondGroupId = null;

    await t.test('mesas: nº físico + letra de grupo; mesma mesa cria grupo novo', async () => {
        const auto = await authWaiter(request(app).post('/table')).send({});
        assert.equal(auto.status, 201);
        assert.equal(auto.body.number, '1');
        assert.equal(auto.body.letter, 'A');
        assert.equal(auto.body.displayName, '1A');

        const named = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(named.status, 201);
        assert.equal(named.body.displayName, '12A');
        tableId = named.body.id;

        // segundo grupo na mesma mesa física → letra seguinte, sem conflito
        const second = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(second.status, 201);
        assert.equal(second.body.letter, 'B');
        assert.equal(second.body.displayName, '12B');
        secondGroupId = second.body.id;

        // consulta por nº físico devolve os grupos ordenados
        const byNumber = await authWaiter(request(app).get('/tables/by-number/12'));
        assert.equal(byNumber.status, 200);
        assert.equal(byNumber.body.number, '12');
        assert.deepEqual(byNumber.body.tabs.map((tab) => tab.displayName), ['12A', '12B']);
        // rastreabilidade: quem abriu a conta vem na resposta
        assert.equal(byNumber.body.tabs[0].openedBy.username, 'joao');

        // fecha já o grupo B (vazio) para não interferir nos testes seguintes
        const closed = await authWaiter(request(app).post(`/table/${secondGroupId}/close-empty`));
        assert.equal(closed.status, 200);
    });

    await t.test('pedido associado a mesa acumula no total por pagar', async () => {
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

    await t.test('pedido para mesa inexistente/fechada dá 400', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            tableId: 9999,
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 400);
    });

    await t.test('listagem e pesquisa por número', async () => {
        const list = await authWaiter(request(app).get('/orders?status=sent'));
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 2);

        const byNumber = await authWaiter(request(app).get('/order/by-number/2'));
        assert.equal(byNumber.status, 200);
        assert.equal(byNumber.body.tableId, tableId);

        const missing = await authWaiter(request(app).get('/order/by-number/99'));
        assert.equal(missing.status, 404);
    });

    await t.test('criações concorrentes recebem números distintos', async () => {
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
        assert.equal(new Set(numbers).size, numbers.length, `números repetidos: ${numbers}`);
    });

    await t.test('fechar mesa: com pedidos por pagar dá 409, vazia fecha', async () => {
        const blocked = await authWaiter(request(app).post(`/table/${tableId}/close-empty`));
        assert.equal(blocked.status, 409);

        const emptyTable = await authWaiter(request(app).post('/table')).send({number: '7'});
        const closed = await authWaiter(request(app).post(`/table/${emptyTable.body.id}/close-empty`));
        assert.equal(closed.status, 200);
        assert.equal(closed.body.status, 'closed');
    });

    await t.test('nº de mesa tem de ser numérico; zeros à esquerda normalizam', async () => {
        for (const bad of ['Esplanada', '12B', '0', '-3', '10000']) {
            const res = await authWaiter(request(app).post('/table')).send({number: bad});
            assert.equal(res.status, 400, `esperava 400 para "${bad}"`);
        }
        const badLookup = await authWaiter(request(app).get('/tables/by-number/abc'));
        assert.equal(badLookup.status, 400);

        // "012" e "12" são a mesma mesa física
        const padded = await authWaiter(request(app).post('/table')).send({number: '012'});
        assert.equal(padded.status, 201);
        assert.equal(padded.body.number, '12');
        await authWaiter(request(app).post(`/table/${padded.body.id}/close-empty`));
    });

    await t.test('/system/info: admin vê estado multi, waiter não acede', async () => {
        const forbidden = await authWaiter(request(app).get('/system/info'));
        assert.equal(forbidden.status, 403);

        const info = await authAdmin(request(app).get('/system/info'));
        assert.equal(info.status, 200);
        assert.equal(info.body.mode, 'multi');
        assert.deepEqual(info.body.multiTerminal, {licensed: true, enabled: true, effective: true});
        assert.equal(info.body.port, Number(process.env.NODE_DOCKER_PORT || 9393));
    });

    await t.test('sem impressora configurada: pedido cria na mesma, printed=false', async () => {
        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'print-1',
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.printed, false);
        assert.equal(res.body.printError, 'Impressora não configurada.');
        assert.equal(res.body.order.printedAt, null);
    });

    await t.test('impressora inválida: pedido cria na mesma, com printError', async () => {
        await db.options.create({name: 'printer', value: 'ImpressoraFantasma'});

        const res = await authWaiter(request(app).post('/order')).send({
            clientRequestId: 'print-2',
            items: [{productId: beer.id, quantity: 1}],
        });
        assert.equal(res.status, 201);
        assert.equal(res.body.printed, false);
        assert.ok(res.body.printError, 'esperava mensagem de erro de impressão');
        assert.equal(res.body.order.printedAt, null);
    });

    await t.test('reimpressão: 404 para pedido inexistente, best-effort para existente', async () => {
        const missing = await authWaiter(request(app).post('/order/99999/reprint'));
        assert.equal(missing.status, 404);

        const res = await authWaiter(request(app).post(`/order/${firstOrderId}/reprint`));
        assert.equal(res.status, 200);
        assert.equal(res.body.printed, false); // não há impressora real nos testes
        assert.ok(res.body.printError);
    });

    await t.test('desligar multiposto volta a bloquear criação (mas não leitura)', async () => {
        await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: false});

        const blocked = await authWaiter(request(app).post('/order'))
            .send({items: [{productId: beer.id, quantity: 1}]});
        assert.equal(blocked.status, 403);

        const list = await authWaiter(request(app).get('/orders'));
        assert.equal(list.status, 200);

        await authAdmin(request(app).post('/option/multi-terminal')).send({enabled: true});
    });

    await t.test('pagar pedido: waiter não pode; admin paga com desconto e cria invoice', async () => {
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

    await t.test('pagar mesa: invoice única, pedidos pagos, mesa fechada', async () => {
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

        // letra reutilizada: 12A fechou, o próximo grupo da mesa 12 volta a ser A
        const reopened = await authWaiter(request(app).post('/table')).send({number: '12'});
        assert.equal(reopened.status, 201);
        assert.equal(reopened.body.displayName, '12A');
        await authWaiter(request(app).post(`/table/${reopened.body.id}/close-empty`));
    });

    await t.test('anulação de itens: exige aprovação de admin e recalcula o total', async () => {
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

        // sem credenciais e sem ser admin → 401
        const noCreds = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id]});
        assert.equal(noCreds.status, 401);

        // credenciais erradas → 401
        const badCreds = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'chefe', adminPassword: 'errada'});
        assert.equal(badCreds.status, 401);

        // credenciais de não-admin → 403
        const notAdmin = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'joao', adminPassword: 'segredo123'});
        assert.equal(notAdmin.status, 403);

        // aprovado pelo admin → item anulado, total recalculado, auditoria preenchida
        const ok = await authWaiter(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [beerItem.id], adminUsername: 'chefe', adminPassword: 'segredo123'});
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        assert.equal(ok.body.fullyCancelled, false);
        assert.equal(ok.body.order.total, 950);
        const cancelledItem = ok.body.order.items.find((i) => i.id === beerItem.id);
        assert.equal(cancelledItem.status, 'cancelled');
        assert.equal(cancelledItem.cancelledById, adminUser.id);
        assert.ok(cancelledItem.cancelledAt);

        // admin autenticado não precisa de credenciais; anular tudo anula o pedido
        const rest = await authAdmin(request(app).post(`/order/${order.id}/cancel-items`))
            .send({itemIds: [dishItem.id]});
        assert.equal(rest.status, 200);
        assert.equal(rest.body.fullyCancelled, true);
        assert.equal(rest.body.order.status, 'cancelled');
        assert.equal(rest.body.order.total, 0);

        // pedido anulado não pode ser pago nem re-anulado
        const payCancelled = await authAdmin(request(app).post(`/order/${order.id}/pay`))
            .send({paymentMethod: 'cash'});
        assert.equal(payCancelled.status, 409);
        const cancelAgain = await authAdmin(request(app).post(`/order/${order.id}/cancel-items`))
            .send({all: true});
        assert.equal(cancelAgain.status, 409);
    });

    await t.test('anular tudo com all:true e recusar em pedidos pagos', async () => {
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

    await t.test('SSE /events: exige token e entrega eventos em tempo real', async () => {
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

    await t.test('rate-limit no login: 6ª tentativa falhada dá 429', async () => {
        for (let i = 0; i < 5; i += 1) {
            const res = await request(app).post('/user/login')
                .send({username: 'atacante', password: `errada-${i}`});
            assert.equal(res.status, 404); // utilizador não existe
        }
        const blocked = await request(app).post('/user/login')
            .send({username: 'atacante', password: 'errada-6'});
        assert.equal(blocked.status, 429);
        assert.ok(blocked.headers['retry-after']);

        // outros utilizadores não são afetados (chave por IP+username)
        const ok = await request(app).post('/user/login')
            .send({username: 'joao', password: 'segredo123'});
        assert.equal(ok.status, 200);
    });

    await t.test('fecho de sessão: bloqueia com pendentes; force anula e fecha mesas', async () => {
        const pendingBefore = await db.orders.count({where: {sessionId, status: 'sent'}});
        const cancelledBefore = await db.orders.count({where: {sessionId, status: 'cancelled'}});
        assert.ok(pendingBefore > 0, 'devia haver pedidos por pagar neste ponto');

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

    assert.ok(sessionId, 'sessão de teste criada');

    await db.sequelize.close();
});
