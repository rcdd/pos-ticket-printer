import bcrypt from 'bcrypt';
import db from "../index.js";
import {emitEvent, EventTypes} from "../../services/events.service.js";
import {tryPrintOrderTicket, tryPrintOrderVoid} from "../../services/orderPrinting.service.js";

const Order = db.orders;
const OrderItem = db.orderItems;
const Table = db.tables;
const Session = db.sessions;
const Product = db.products;
const Menu = db.menus;
const {OrderStatus, OrderItemStatus, TableStatus} = db;

const MAX_NUMBER_RETRIES = 3;

const orderInclude = [
    {model: OrderItem, as: 'items'},
    {model: Table, as: 'table'},
    {model: db.users, as: 'user', attributes: ['id', 'name', 'username', 'role']},
];

export const getActiveSession = async (transaction = null) => {
    return Session.findOne({
        where: {status: "opened"},
        order: [['createdAt', 'DESC']],
        transaction,
    });
};

// Valida os itens do carrinho e resolve preço/nome no servidor.
// Nunca confiamos em preços enviados pelo terminal.
const resolveItems = async (rawItems) => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        const err = new Error("O pedido tem de conter pelo menos um item.");
        err.statusCode = 400;
        throw err;
    }

    const resolved = [];
    for (const raw of rawItems) {
        const quantity = Number(raw?.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            const err = new Error("Cada item tem de ter uma quantidade inteira e positiva.");
            err.statusCode = 400;
            throw err;
        }

        const productId = raw?.productId ?? null;
        const menuId = raw?.menuId ?? null;
        if ((productId && menuId) || (!productId && !menuId)) {
            const err = new Error("Cada item tem de indicar um produto ou um menu (apenas um).");
            err.statusCode = 400;
            throw err;
        }

        if (productId) {
            const product = await Product.findOne({where: {id: productId, isDeleted: false}});
            if (!product) {
                const err = new Error(`Produto ${productId} não encontrado.`);
                err.statusCode = 400;
                throw err;
            }
            resolved.push({
                productId: product.id,
                menuId: null,
                nameSnapshot: product.name,
                quantity,
                price: product.price ?? 0,
            });
        } else {
            const menu = await Menu.findOne({where: {id: menuId, isDeleted: false}});
            if (!menu) {
                const err = new Error(`Menu ${menuId} não encontrado.`);
                err.statusCode = 400;
                throw err;
            }
            resolved.push({
                productId: null,
                menuId: menu.id,
                nameSnapshot: menu.name,
                quantity,
                price: menu.price ?? 0,
            });
        }
    }
    return resolved;
};

export const computeTotal = (items) =>
    items
        .filter((item) => (item.status ?? OrderItemStatus.ACTIVE) === OrderItemStatus.ACTIVE)
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

const isUniqueViolation = (error) => error?.name === 'SequelizeUniqueConstraintError';
const isRetryableDbError = (error) => {
    if (isUniqueViolation(error)) return true;
    const code = error?.parent?.code ?? error?.original?.code;
    return code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT';
};

// Cria o pedido numa transação, atribuindo o número sequencial da sessão.
// O lock na linha da sessão serializa a numeração entre terminais; o índice
// único (sessionId, number) e o retry são a rede de segurança.
const createOrderWithNumber = async ({sessionId, tableId, userId, note, clientRequestId, items}) => {
    let lastError = null;
    for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt += 1) {
        try {
            return await db.sequelize.transaction(async (transaction) => {
                await Session.findByPk(sessionId, {transaction, lock: transaction.LOCK.UPDATE});
                const maxNumber = await Order.max('number', {where: {sessionId}, transaction});
                const number = (Number.isFinite(maxNumber) ? maxNumber : 0) + 1;

                const order = await Order.create({
                    number,
                    sessionId,
                    tableId,
                    userId,
                    note: note || null,
                    clientRequestId: clientRequestId || null,
                    status: OrderStatus.SENT,
                    total: computeTotal(items),
                }, {transaction});

                await OrderItem.bulkCreate(
                    items.map((item) => ({...item, orderId: order.id})),
                    {transaction},
                );

                return order;
            });
        } catch (error) {
            if (isRetryableDbError(error)) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }
    throw lastError ?? new Error("Não foi possível atribuir um número ao pedido.");
};

export const create = async (req, res) => {
    try {
        const {tableId, note, clientRequestId} = req.body ?? {};

        // Idempotência: um retry do terminal devolve o pedido já criado
        if (clientRequestId) {
            const existing = await Order.findOne({
                where: {clientRequestId},
                include: orderInclude,
            });
            if (existing) {
                return res.send({
                    order: existing,
                    duplicate: true,
                    printed: Boolean(existing.printedAt),
                    printError: null,
                });
            }
        }

        const session = await getActiveSession();
        if (!session) {
            return res.status(409).send({
                message: "Não existe nenhuma sessão de caixa aberta. Abra a sessão no PC principal.",
            });
        }

        let table = null;
        if (tableId) {
            table = await Table.findByPk(tableId);
            if (!table || table.status !== TableStatus.OPEN || table.sessionId !== session.id) {
                return res.status(400).send({
                    message: "A mesa indicada não está aberta nesta sessão.",
                });
            }
        }

        const items = await resolveItems(req.body?.items);

        const order = await createOrderWithNumber({
            sessionId: session.id,
            tableId: table?.id ?? null,
            userId: req.user?.id ?? null,
            note,
            clientRequestId,
            items,
        });

        const full = await Order.findByPk(order.id, {include: orderInclude});

        const printResult = await tryPrintOrderTicket(full);
        if (printResult.printed) {
            await full.update({printedAt: new Date()});
        }

        emitEvent(EventTypes.ORDER_CREATED, {orderId: full.id, number: full.number, tableId: full.tableId});
        if (full.tableId) {
            emitEvent(EventTypes.TABLE_UPDATED, {tableId: full.tableId});
        }

        res.status(201).send({
            order: full,
            duplicate: false,
            printed: printResult.printed,
            printError: printResult.error,
        });
    } catch (error) {
        // Corrida no clientRequestId (dois retries em simultâneo): devolve o existente
        if (isUniqueViolation(error) && req.body?.clientRequestId) {
            const existing = await Order.findOne({
                where: {clientRequestId: req.body.clientRequestId},
                include: orderInclude,
            });
            if (existing) {
                return res.send({order: existing, duplicate: true});
            }
        }
        const status = error.statusCode ?? 500;
        if (status >= 500) {
            console.error('[orders.create] erro:', error);
        }
        res.status(status).send({
            message: status >= 500 ? "Não foi possível criar o pedido." : error.message,
        });
    }
};

export const findAll = async (req, res) => {
    try {
        const where = {};
        if (req.query.status) {
            const statuses = String(req.query.status).split(',').filter(Boolean);
            const invalid = statuses.filter((s) => !Object.values(OrderStatus).includes(s));
            if (invalid.length) {
                return res.status(400).send({message: `Estado inválido: ${invalid.join(', ')}.`});
            }
            where.status = statuses;
        }
        if (req.query.tableId) {
            where.tableId = Number(req.query.tableId);
        }

        if (req.query.sessionId) {
            where.sessionId = Number(req.query.sessionId);
        } else {
            const session = await getActiveSession();
            if (!session) {
                return res.send([]);
            }
            where.sessionId = session.id;
        }

        const orders = await Order.findAll({
            where,
            include: orderInclude,
            order: [['number', 'DESC']],
        });
        res.send(orders);
    } catch (error) {
        console.error('[orders.findAll] erro:', error);
        res.status(500).send({message: "Não foi possível obter os pedidos."});
    }
};

export const findOne = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {include: orderInclude});
        if (!order) {
            return res.status(404).send({message: `Pedido ${req.params.id} não encontrado.`});
        }
        res.send(order);
    } catch (error) {
        console.error('[orders.findOne] erro:', error);
        res.status(500).send({message: "Não foi possível obter o pedido."});
    }
};

// Aprovação de admin para anulações: ou o próprio utilizador autenticado é
// admin, ou vêm credenciais de admin no corpo (fluxo do terminal, onde quem
// está autenticado é o empregado).
const resolveApprovingAdmin = async (req) => {
    if (req.user?.role === db.UserRoles.ADMIN) {
        const self = await db.users.findByPk(req.user.id);
        if (self && !self.isDeleted) return self;
    }

    const username = String(req.body?.adminUsername || '').trim();
    const password = String(req.body?.adminPassword || '');
    if (!username || !password) {
        const err = new Error("A anulação requer aprovação de um administrador.");
        err.statusCode = 401;
        throw err;
    }

    const admin = await db.users.findOne({where: {username, isDeleted: false}});
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
        const err = new Error("Credenciais de administrador inválidas.");
        err.statusCode = 401;
        throw err;
    }
    if (admin.role !== db.UserRoles.ADMIN) {
        const err = new Error("O utilizador indicado não é administrador.");
        err.statusCode = 403;
        throw err;
    }
    return admin;
};

// Anula itens de um pedido já enviado (aprovado por admin) e imprime
// talão de anulação para a cozinha. Anular tudo anula o pedido.
export const cancelItems = async (req, res) => {
    try {
        const admin = await resolveApprovingAdmin(req);

        const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(Number) : [];
        const cancelAll = req.body?.all === true;

        const result = await db.sequelize.transaction(async (transaction) => {
            const order = await Order.findByPk(req.params.id, {
                include: [{model: OrderItem, as: 'items'}, {model: Table, as: 'table'}],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            if (!order) {
                return {error: {status: 404, message: `Pedido ${req.params.id} não encontrado.`}};
            }
            if (order.status !== OrderStatus.SENT) {
                return {error: {status: 409, message: `O pedido #${order.number} já foi ${order.status === OrderStatus.PAID ? 'pago' : 'anulado'} — não é possível anular itens.`}};
            }

            const activeItems = (order.items ?? []).filter((item) => item.status === db.OrderItemStatus.ACTIVE);
            const targets = cancelAll
                ? activeItems
                : activeItems.filter((item) => itemIds.includes(item.id));

            if (targets.length === 0) {
                return {error: {status: 400, message: "Nenhum item válido para anular."}};
            }

            const now = new Date();
            await OrderItem.update(
                {status: db.OrderItemStatus.CANCELLED, cancelledById: admin.id, cancelledAt: now},
                {where: {id: targets.map((item) => item.id)}, transaction},
            );

            const remaining = activeItems.filter((item) => !targets.some((t) => t.id === item.id));
            const newTotal = computeTotal(remaining);
            const orderUpdate = {total: newTotal};
            if (remaining.length === 0) {
                orderUpdate.status = OrderStatus.CANCELLED;
            }
            await order.update(orderUpdate, {transaction});

            return {order, cancelledItems: targets.map((item) => item.toJSON()), fullyCancelled: remaining.length === 0};
        });

        if (result.error) {
            return res.status(result.error.status).send({message: result.error.message});
        }

        const voidPrint = await tryPrintOrderVoid(
            result.order,
            result.cancelledItems,
            admin.name || admin.username,
        );

        emitEvent(EventTypes.ORDER_UPDATED, {orderId: result.order.id, cancelled: true});
        if (result.order.tableId) {
            emitEvent(EventTypes.TABLE_UPDATED, {tableId: result.order.tableId});
        }

        res.send({
            order: await Order.findByPk(result.order.id, {include: orderInclude}),
            fullyCancelled: result.fullyCancelled,
            voidPrinted: voidPrint.printed,
            voidPrintError: voidPrint.error,
        });
    } catch (error) {
        const status = error.statusCode ?? 500;
        if (status >= 500) {
            console.error('[orders.cancelItems] erro:', error);
        }
        res.status(status).send({
            message: status >= 500 ? "Não foi possível anular os itens." : error.message,
        });
    }
};

const parseDiscount = (raw) => {
    const value = Number(raw ?? 0);
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    return Math.floor(value);
};

const validPaymentMethod = (method) =>
    ['cash', 'card', 'mbway', 'other'].includes(method);

// Pagamento de um pedido avulso na caixa: converte o pedido numa invoice
// normal (relatórios/tesouraria continuam a funcionar como sempre).
export const pay = async (req, res) => {
    try {
        const paymentMethod = req.body?.paymentMethod ?? 'cash';
        if (!validPaymentMethod(paymentMethod)) {
            return res.status(400).send({message: "Método de pagamento inválido."});
        }
        const discountPercent = parseDiscount(req.body?.discount);
        if (discountPercent === null) {
            return res.status(400).send({message: "O desconto tem de estar entre 0 e 100."});
        }

        const result = await db.sequelize.transaction(async (transaction) => {
            const order = await Order.findByPk(req.params.id, {
                include: [{model: OrderItem, as: 'items'}],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });
            if (!order) {
                return {error: {status: 404, message: `Pedido ${req.params.id} não encontrado.`}};
            }
            if (order.status !== OrderStatus.SENT) {
                return {error: {status: 409, message: `O pedido #${order.number} já foi ${order.status === OrderStatus.PAID ? 'pago' : 'anulado'}.`}};
            }

            const activeItems = (order.items ?? []).filter((item) => item.status === db.OrderItemStatus.ACTIVE);
            const total = computeTotal(activeItems);
            const discountedTotal = Math.round(total * (1 - discountPercent / 100));

            const invoice = await db.invoices.create({
                total: discountedTotal,
                userId: req.user?.id ?? null,
                sessionId: order.sessionId,
                paymentMethod,
                discountPercent,
                records: activeItems.map((item) => ({
                    quantity: item.quantity,
                    price: item.price,
                    product: item.productId ?? null,
                    menu: item.menuId ?? null,
                })),
            }, {include: [db.records], transaction});

            await order.update({status: OrderStatus.PAID, invoiceId: invoice.id}, {transaction});
            return {order, invoiceId: invoice.id, total: discountedTotal};
        });

        if (result.error) {
            return res.status(result.error.status).send({message: result.error.message});
        }

        emitEvent(EventTypes.ORDER_UPDATED, {orderId: result.order.id, status: OrderStatus.PAID});
        if (result.order.tableId) {
            emitEvent(EventTypes.TABLE_UPDATED, {tableId: result.order.tableId});
        }

        res.send({
            message: "ok",
            invoiceId: result.invoiceId,
            total: result.total,
            order: await Order.findByPk(result.order.id, {include: orderInclude}),
        });
    } catch (error) {
        console.error('[orders.pay] erro:', error);
        res.status(500).send({message: "Não foi possível registar o pagamento."});
    }
};

export const reprint = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {include: orderInclude});
        if (!order) {
            return res.status(404).send({message: `Pedido ${req.params.id} não encontrado.`});
        }
        if (order.status === OrderStatus.CANCELLED) {
            return res.status(400).send({message: "O pedido foi anulado — não pode ser reimpresso."});
        }

        const wasPrinted = Boolean(order.printedAt);
        const printResult = await tryPrintOrderTicket(order, {reprint: wasPrinted});
        if (printResult.printed && !wasPrinted) {
            await order.update({printedAt: new Date()});
        }

        res.send({printed: printResult.printed, printError: printResult.error});
    } catch (error) {
        console.error('[orders.reprint] erro:', error);
        res.status(500).send({message: "Não foi possível reimprimir o pedido."});
    }
};

// Procura por número (na sessão ativa) — atalho da caixa "pagar pedido nº X"
export const findByNumber = async (req, res) => {
    try {
        const number = Number(req.params.number);
        if (!Number.isInteger(number) || number <= 0) {
            return res.status(400).send({message: "Número de pedido inválido."});
        }
        const session = await getActiveSession();
        if (!session) {
            return res.status(404).send({message: "Não existe nenhuma sessão aberta."});
        }
        const order = await Order.findOne({
            where: {sessionId: session.id, number},
            include: orderInclude,
        });
        if (!order) {
            return res.status(404).send({message: `Pedido #${number} não encontrado nesta sessão.`});
        }
        res.send(order);
    } catch (error) {
        console.error('[orders.findByNumber] erro:', error);
        res.status(500).send({message: "Não foi possível obter o pedido."});
    }
};
