import db from "../index.js";
import {emitEvent, EventTypes} from "../../services/events.service.js";
import {getActiveSession, computeTotal} from "./orders.controller.js";

const Table = db.tables;
const Order = db.orders;
const OrderItem = db.orderItems;
const {TableStatus, OrderStatus} = db;

// quem abriu a conta (responsável pela mesa/grupo) — para tracking
const openedByInclude = {model: db.users, as: 'openedBy', attributes: ['id', 'name', 'username']};

const normalizeNumber = (value) => String(value ?? '').trim();

// Nº de mesa física: estritamente numérico (1–9999), sem zeros à esquerda
// ("01" e "1" são a mesma mesa). Devolve null se inválido.
const normalizeTableNumber = (value) => {
    const raw = normalizeNumber(value);
    if (!/^\d+$/.test(raw)) return null;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 9999) return null;
    return String(parsed);
};

// Sugere o próximo número de mesa livre: menor inteiro sem contas abertas
const suggestNumber = async (sessionId, transaction = null) => {
    const open = await Table.findAll({
        where: {sessionId, status: TableStatus.OPEN},
        attributes: ['number'],
        transaction,
    });
    const used = new Set(open.map((t) => t.number));
    let candidate = 1;
    while (used.has(String(candidate))) {
        candidate += 1;
    }
    return String(candidate);
};

// Primeira letra livre entre os grupos abertos da mesa (reutiliza após fecho)
const assignLetter = (openTabs) => {
    const used = new Set(openTabs.map((tab) => tab.letter).filter(Boolean));
    for (let i = 0; i < 26; i += 1) {
        const letter = String.fromCharCode(65 + i); // A..Z
        if (!used.has(letter)) {
            return letter;
        }
    }
    return null;
};

// ordenação natural: mesa 2 antes de mesa 10; letra desempata
const sortTabs = (tabs) => [...tabs].sort((a, b) => {
    const numA = Number(a.number);
    const numB = Number(b.number);
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
        return numA - numB;
    }
    if (a.number !== b.number) {
        return String(a.number).localeCompare(String(b.number), 'pt-PT', {numeric: true});
    }
    return String(a.letter ?? '').localeCompare(String(b.letter ?? ''));
});

const withUnpaidTotals = async (tables) => {
    if (!tables.length) return [];
    const orders = await Order.findAll({
        where: {
            tableId: tables.map((t) => t.id),
            status: OrderStatus.SENT,
        },
        include: [{model: OrderItem, as: 'items'}],
    });

    const byTable = new Map();
    for (const order of orders) {
        const entry = byTable.get(order.tableId) ?? {unpaidTotal: 0, openOrders: 0};
        entry.unpaidTotal += computeTotal(order.items ?? []);
        entry.openOrders += 1;
        byTable.set(order.tableId, entry);
    }

    return tables.map((table) => ({
        ...table.toJSON(),
        unpaidTotal: byTable.get(table.id)?.unpaidTotal ?? 0,
        openOrders: byTable.get(table.id)?.openOrders ?? 0,
    }));
};

// Abre uma conta/grupo: o empregado indica o nº da mesa física e o sistema
// atribui a letra do grupo (12 → 12A; segundo grupo na mesma mesa → 12B).
export const open = async (req, res) => {
    try {
        const session = await getActiveSession();
        if (!session) {
            return res.status(409).send({
                message: "Não existe nenhuma sessão de caixa aberta. Abra a sessão no PC principal.",
            });
        }

        const result = await db.sequelize.transaction(async (transaction) => {
            // lock na sessão: serializa a atribuição de letras entre terminais
            await db.sessions.findByPk(session.id, {transaction, lock: transaction.LOCK.UPDATE});

            let number = null;
            const rawNumber = normalizeNumber(req.body?.number);
            if (!rawNumber) {
                number = await suggestNumber(session.id, transaction);
            } else {
                number = normalizeTableNumber(rawNumber);
                if (!number) {
                    return {error: {status: 400, message: "O número da mesa tem de ser numérico (1–9999)."}};
                }
            }

            const openTabs = await Table.findAll({
                where: {sessionId: session.id, status: TableStatus.OPEN, number},
                transaction,
            });

            const letter = assignLetter(openTabs);
            if (!letter) {
                return {error: {status: 409, message: `A mesa ${number} já tem 26 grupos abertos.`}};
            }

            const table = await Table.create({
                number,
                letter,
                sessionId: session.id,
                openedById: req.user?.id ?? null,
                status: TableStatus.OPEN,
            }, {transaction});

            return {table};
        });

        if (result.error) {
            return res.status(result.error.status).send({message: result.error.message});
        }

        emitEvent(EventTypes.TABLE_UPDATED, {tableId: result.table.id});
        res.status(201).send(result.table);
    } catch (error) {
        console.error('[tables.open] erro:', error);
        res.status(500).send({message: "Não foi possível abrir a mesa."});
    }
};

// Contas abertas de uma mesa física (fluxo do terminal: nº → grupos)
export const findByNumber = async (req, res) => {
    try {
        const session = await getActiveSession();
        if (!session) {
            return res.send({number: normalizeNumber(req.params.number), tabs: []});
        }

        const number = normalizeTableNumber(req.params.number);
        if (!number) {
            return res.status(400).send({message: "O número da mesa tem de ser numérico (1–9999)."});
        }

        const tabs = await Table.findAll({
            where: {sessionId: session.id, status: TableStatus.OPEN, number},
            include: [openedByInclude],
        });

        res.send({
            number,
            tabs: sortTabs(await withUnpaidTotals(tabs)),
        });
    } catch (error) {
        console.error('[tables.findByNumber] erro:', error);
        res.status(500).send({message: "Não foi possível obter a mesa."});
    }
};

export const findAll = async (req, res) => {
    try {
        const session = await getActiveSession();
        if (!session) {
            return res.send([]);
        }

        const where = {sessionId: session.id};
        if (req.query.status) {
            if (!Object.values(TableStatus).includes(req.query.status)) {
                return res.status(400).send({message: `Estado inválido: ${req.query.status}.`});
            }
            where.status = req.query.status;
        } else {
            where.status = TableStatus.OPEN;
        }

        const tables = await Table.findAll({where, include: [openedByInclude]});
        res.send(sortTabs(await withUnpaidTotals(tables)));
    } catch (error) {
        console.error('[tables.findAll] erro:', error);
        res.status(500).send({message: "Não foi possível obter as mesas."});
    }
};

export const findOne = async (req, res) => {
    try {
        const table = await Table.findByPk(req.params.id, {
            include: [
                openedByInclude,
                {
                    model: Order,
                    as: 'orders',
                    include: [
                        {model: OrderItem, as: 'items'},
                        {model: db.users, as: 'user', attributes: ['id', 'name', 'username']},
                    ],
                },
            ],
            order: [[{model: Order, as: 'orders'}, 'number', 'ASC']],
        });
        if (!table) {
            return res.status(404).send({message: `Mesa ${req.params.id} não encontrada.`});
        }

        const unpaidTotal = (table.orders ?? [])
            .filter((order) => order.status === OrderStatus.SENT)
            .reduce((sum, order) => sum + computeTotal(order.items ?? []), 0);

        res.send({...table.toJSON(), unpaidTotal});
    } catch (error) {
        console.error('[tables.findOne] erro:', error);
        res.status(500).send({message: "Não foi possível obter a mesa."});
    }
};

// Pagamento da mesa inteira na caixa: uma invoice única com os itens de
// todos os pedidos por pagar; os pedidos ficam pagos e a mesa fecha.
export const pay = async (req, res) => {
    try {
        const paymentMethod = req.body?.paymentMethod ?? 'cash';
        if (!['cash', 'card', 'mbway', 'other'].includes(paymentMethod)) {
            return res.status(400).send({message: "Método de pagamento inválido."});
        }
        const discountRaw = Number(req.body?.discount ?? 0);
        if (!Number.isFinite(discountRaw) || discountRaw < 0 || discountRaw > 100) {
            return res.status(400).send({message: "O desconto tem de estar entre 0 e 100."});
        }
        const discountPercent = Math.floor(discountRaw);

        const result = await db.sequelize.transaction(async (transaction) => {
            const table = await Table.findByPk(req.params.id, {
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            if (!table) {
                return {error: {status: 404, message: `Mesa ${req.params.id} não encontrada.`}};
            }
            if (table.status !== TableStatus.OPEN) {
                return {error: {status: 400, message: "A mesa já está fechada."}};
            }

            const orders = await Order.findAll({
                where: {tableId: table.id, status: OrderStatus.SENT},
                include: [{model: OrderItem, as: 'items'}],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            if (orders.length === 0) {
                await table.update({status: TableStatus.CLOSED, closedAt: new Date()}, {transaction});
                return {table, invoiceId: null, total: 0, orderCount: 0};
            }

            const activeItems = orders.flatMap((order) =>
                (order.items ?? []).filter((item) => item.status === db.OrderItemStatus.ACTIVE));
            const total = computeTotal(activeItems);
            const discountedTotal = Math.round(total * (1 - discountPercent / 100));

            const invoice = await db.invoices.create({
                total: discountedTotal,
                userId: req.user?.id ?? null,
                sessionId: table.sessionId,
                paymentMethod,
                discountPercent,
                records: activeItems.map((item) => ({
                    quantity: item.quantity,
                    price: item.price,
                    product: item.productId ?? null,
                    menu: item.menuId ?? null,
                })),
            }, {include: [db.records], transaction});

            await Order.update(
                {status: OrderStatus.PAID, invoiceId: invoice.id},
                {where: {id: orders.map((order) => order.id)}, transaction},
            );
            await table.update({status: TableStatus.CLOSED, closedAt: new Date()}, {transaction});

            return {table, invoiceId: invoice.id, total: discountedTotal, orderCount: orders.length};
        });

        if (result.error) {
            return res.status(result.error.status).send({message: result.error.message});
        }

        emitEvent(EventTypes.TABLE_UPDATED, {tableId: result.table.id, status: TableStatus.CLOSED});
        emitEvent(EventTypes.ORDER_UPDATED, {tableId: result.table.id});

        res.send({
            message: "ok",
            invoiceId: result.invoiceId,
            total: result.total,
            orderCount: result.orderCount,
        });
    } catch (error) {
        console.error('[tables.pay] erro:', error);
        res.status(500).send({message: "Não foi possível registar o pagamento da mesa."});
    }
};

// Fecha uma mesa sem consumo por pagar (o fecho com pagamento é feito na caixa)
export const closeEmpty = async (req, res) => {
    try {
        const table = await Table.findByPk(req.params.id);
        if (!table) {
            return res.status(404).send({message: `Mesa ${req.params.id} não encontrada.`});
        }
        if (table.status !== TableStatus.OPEN) {
            return res.status(400).send({message: "A mesa já está fechada."});
        }

        const pending = await Order.count({
            where: {tableId: table.id, status: OrderStatus.SENT},
        });
        if (pending > 0) {
            return res.status(409).send({
                message: "A mesa tem pedidos por pagar. Feche-a na caixa através do pagamento.",
            });
        }

        await table.update({status: TableStatus.CLOSED, closedAt: new Date()});
        emitEvent(EventTypes.TABLE_UPDATED, {tableId: table.id});
        res.send(table);
    } catch (error) {
        console.error('[tables.closeEmpty] erro:', error);
        res.status(500).send({message: "Não foi possível fechar a mesa."});
    }
};
