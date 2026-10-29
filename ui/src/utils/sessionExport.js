import {computeSessionAggregates} from "./sessionAggregates";

// Session export (Relatórios → Exportar Excel): the end-of-session ticket as
// a workbook, for one session or every session in a date range. Totals,
// payment methods and final cash come from computeSessionAggregates — the
// same numbers the printed ticket shows. Money in euros (numbers, so Excel
// can sum them), dates as Date.

const METHOD_LABELS = {cash: 'Dinheiro', card: 'Multibanco', mbway: 'MBWay', other: 'Outro'};
const METHODS = ['cash', 'card', 'mbway', 'other'];

const euros = (cents) => Math.round(Number(cents || 0)) / 100;
const asDate = (value) => (value ? new Date(value) : null);

const invoiceParcels = (inv) => (Array.isArray(inv?.payments) && inv.payments.length > 0
    ? inv.payments
    : [{method: inv?.paymentMethod ?? 'cash', amount: inv?.total ?? 0}]);

const recordItem = (rec) => rec?.productItem || rec?.menuItem || null;

// Pure: everything the workbook needs, sheet by sheet.
// sessions: session rows; invoices: all invoices (with records/payments/
// orders); movementsBySession / ordersBySession: Map(sessionId → list);
// userName(id) → display name; includeVoids: multi-terminal mode on.
export function buildSessionExport({
                                       sessions = [],
                                       invoices = [],
                                       movementsBySession = new Map(),
                                       ordersBySession = new Map(),
                                       userName = (id) => (id ? `Utilizador #${id}` : ''),
                                       includeVoids = false,
                                   }) {
    const ordered = [...sessions].sort((a, b) => new Date(a.openedAt) - new Date(b.openedAt));
    const summary = [];
    const products = [];
    const productsTotal = new Map();
    const invoiceRows = [];
    const movements = [];
    const voids = [];

    for (const s of ordered) {
        const sessionInvoices = invoices.filter((inv) => String(inv.sessionId) === String(s.id));
        const cashMovements = movementsBySession.get(s.id) ?? [];
        const agg = computeSessionAggregates(sessionInvoices, Number(s.initialAmount || 0), cashMovements);
        const byMethod = Object.fromEntries(agg.paymentsAgg.map((p) => [p.method, p.amount]));
        const discountTotal = agg.discountedProductsAgg.reduce((acc, p) => acc + p.total, 0);

        summary.push({
            session: s.id,
            test: s.isTest ? 'Sim' : 'Não',
            openedAt: asDate(s.openedAt),
            openedBy: userName(s.userOpenId),
            closedAt: asDate(s.closedAt),
            closedBy: s.closedAt ? userName(s.userCloseId) : 'Sessão aberta',
            initialAmount: euros(s.initialAmount),
            total: euros(agg.totalAmountCents),
            ...Object.fromEntries(METHODS.map((m) => [m, euros(byMethod[m])])),
            operations: sessionInvoices.length,
            revoked: sessionInvoices.filter((inv) => inv.isDeleted).length,
            discounted: euros(discountTotal),
            cashIn: euros(agg.cashIn),
            cashOut: euros(agg.cashOut),
            finalCash: euros(agg.finalCashValueCents),
            notes: s.notes ?? '',
        });

        // products: like the Produtos tab (menus included, valid invoices
        // only, unit price as sold, discounted lines apart)
        for (const inv of sessionInvoices) {
            if (inv.isDeleted) continue;
            const disc = inv.discountPercent || 0;
            const note = disc > 0 ? (inv.discountNote ?? '') : '';
            for (const rec of inv.records ?? []) {
                const item = recordItem(rec);
                if (!item) continue;
                const price = rec.price ?? item.price ?? 0;
                const unit = disc > 0 ? Math.round(price * (1 - disc / 100)) : price;
                const qty = Number(rec.quantity || 0);
                const kind = rec.productItem ? 'Produto' : 'Menu';
                const zone = item.zone?.name || (rec.productItem ? '—' : 'Menus');
                const totalKey = `${kind}-${item.id}-${disc}-${note}`;
                const prev = productsTotal.get(totalKey) ?? {zone, kind, name: item.name, discount: disc, note, quantity: 0, total: 0};
                prev.quantity += qty;
                prev.total += unit * qty;
                productsTotal.set(totalKey, prev);
                products.push({session: s.id, itemId: item.id, zone, kind, name: item.name, discount: disc, note, quantity: qty, total: unit * qty});
            }
        }

        for (const inv of sessionInvoices) {
            const parcels = invoiceParcels(inv);
            const paid = Object.fromEntries(METHODS.map((m) => [m, 0]));
            for (const p of parcels) paid[p.method in paid ? p.method : 'other'] += Number(p.amount || 0);
            const origin = (inv.orders ?? []).length > 0
                ? inv.orders.map((o) => `Pedido #${String(o.number).padStart(3, '0')}${o.table?.number ? ` · Mesa ${o.table.number}` : ''}`).join(', ')
                : 'Venda direta';
            invoiceRows.push({
                session: s.id,
                invoice: inv.id,
                date: asDate(inv.createdAt),
                user: userName(inv.userId),
                origin,
                items: (inv.records ?? [])
                    .map((rec) => `${rec.quantity}× ${recordItem(rec)?.name ?? '?'}`)
                    .join(', '),
                discount: inv.discountPercent || 0,
                note: inv.discountPercent > 0 ? (inv.discountNote ?? '') : '',
                total: euros(inv.total),
                ...Object.fromEntries(METHODS.map((m) => [m, euros(paid[m])])),
                status: inv.isDeleted ? 'Anulada' : 'Válida',
            });
        }

        for (const m of cashMovements) {
            movements.push({
                session: s.id,
                date: asDate(m.createdAt),
                type: m.type === 'CASH_IN' ? 'Entrada' : 'Saída',
                amount: euros(m.type === 'CASH_OUT' ? -Number(m.amount || 0) : m.amount),
                reason: m.reason ?? '',
                user: m.user?.name || m.user?.username || userName(m.userId),
            });
        }

        for (const order of ordersBySession.get(s.id) ?? []) {
            for (const item of order.items ?? []) {
                if (item.status !== 'cancelled') continue;
                voids.push({
                    session: s.id,
                    date: asDate(item.cancelledAt),
                    order: `#${String(order.number).padStart(3, '0')}`,
                    table: order.table ? (order.table.displayName || order.table.number) : 'Balcão',
                    name: item.nameSnapshot,
                    quantity: item.quantity,
                    amount: euros(item.price * item.quantity),
                    orderedBy: order.user?.name || order.user?.username || userName(order.userId),
                    cancelledBy: userName(item.cancelledById),
                    wholeOrder: order.status === 'cancelled' ? 'Sim' : 'Não',
                });
            }
        }
    }

    const sum = (rows, key) => Math.round(rows.reduce((acc, r) => acc + (r[key] || 0), 0) * 100) / 100;
    if (summary.length > 1) {
        summary.push({
            session: 'TOTAL',
            initialAmount: sum(summary, 'initialAmount'),
            total: sum(summary, 'total'),
            ...Object.fromEntries(METHODS.map((m) => [m, sum(summary, m)])),
            operations: summary.reduce((acc, r) => acc + r.operations, 0),
            revoked: summary.reduce((acc, r) => acc + r.revoked, 0),
            discounted: sum(summary, 'discounted'),
            cashIn: sum(summary, 'cashIn'),
            cashOut: sum(summary, 'cashOut'),
            finalCash: sum(summary, 'finalCash'),
        });
    }

    const byZoneThenName = (a, b) => String(a.zone).localeCompare(String(b.zone), 'pt')
        || String(a.name).localeCompare(String(b.name), 'pt') || a.discount - b.discount
        || String(a.note).localeCompare(String(b.note), 'pt');

    // the same product sold in several invoices of a session → one line
    const perSession = new Map();
    for (const p of products) {
        const key = `${p.session}-${p.kind}-${p.itemId}-${p.discount}-${p.note}`;
        const prev = perSession.get(key) ?? {...p, quantity: 0, total: 0};
        prev.quantity += p.quantity;
        prev.total += p.total;
        perSession.set(key, prev);
    }

    return {
        summary,
        products: [...perSession.values()]
            .sort((a, b) => a.session - b.session || byZoneThenName(a, b))
            .map((p) => ({...p, total: euros(p.total)})),
        // across sessions — only worth a sheet when there is more than one
        productsTotal: ordered.length > 1
            ? [...productsTotal.values()].sort(byZoneThenName).map((p) => ({...p, total: euros(p.total)}))
            : null,
        invoices: invoiceRows,
        movements,
        voids: includeVoids || voids.length > 0 ? voids : null,
    };
}

const MONEY = '#,##0.00 "€"';
const DATE = 'dd/mm/yyyy hh:mm';

const SHEETS = [
    {
        key: 'summary', name: 'Resumo', columns: [
            ['Sessão', 'session', 9], ['Teste', 'test', 7], ['Aberta em', 'openedAt', 17, DATE],
            ['Aberta por', 'openedBy', 16], ['Fechada em', 'closedAt', 17, DATE], ['Fechada por', 'closedBy', 16],
            ['Fundo inicial', 'initialAmount', 13, MONEY], ['Total vendas', 'total', 13, MONEY],
            ...METHODS.map((m) => [METHOD_LABELS[m], m, 12, MONEY]),
            ['Nº operações', 'operations', 12], ['Faturas anuladas', 'revoked', 15],
            ['Vendas c/ desconto', 'discounted', 17, MONEY], ['Entradas caixa', 'cashIn', 14, MONEY],
            ['Saídas caixa', 'cashOut', 13, MONEY], ['Caixa final (dinheiro)', 'finalCash', 20, MONEY],
            ['Notas', 'notes', 30],
        ],
    },
    {
        key: 'products', name: 'Produtos', columns: [
            ['Sessão', 'session', 9], ['Zona', 'zone', 16], ['Tipo', 'kind', 9], ['Produto', 'name', 26],
            ['Desconto %', 'discount', 11], ['Motivo desconto', 'note', 22],
            ['Quantidade', 'quantity', 11], ['Total', 'total', 12, MONEY],
        ],
    },
    {
        key: 'productsTotal', name: 'Produtos (total)', columns: [
            ['Zona', 'zone', 16], ['Tipo', 'kind', 9], ['Produto', 'name', 26],
            ['Desconto %', 'discount', 11], ['Motivo desconto', 'note', 22],
            ['Quantidade', 'quantity', 11], ['Total', 'total', 12, MONEY],
        ],
    },
    {
        key: 'invoices', name: 'Faturas', columns: [
            ['Sessão', 'session', 9], ['Fatura', 'invoice', 9], ['Data', 'date', 17, DATE],
            ['Utilizador', 'user', 16], ['Origem', 'origin', 22], ['Itens', 'items', 40],
            ['Desconto %', 'discount', 11], ['Motivo desconto', 'note', 22], ['Total', 'total', 12, MONEY],
            ...METHODS.map((m) => [METHOD_LABELS[m], m, 12, MONEY]),
            ['Estado', 'status', 10],
        ],
    },
    {
        key: 'movements', name: 'Movimentos de caixa', columns: [
            ['Sessão', 'session', 9], ['Data', 'date', 17, DATE], ['Tipo', 'type', 10],
            ['Valor', 'amount', 12, MONEY], ['Motivo', 'reason', 30], ['Utilizador', 'user', 16],
        ],
    },
    {
        key: 'voids', name: 'Anulações', columns: [
            ['Sessão', 'session', 9], ['Data', 'date', 17, DATE], ['Pedido', 'order', 9],
            ['Mesa', 'table', 9], ['Produto', 'name', 26], ['Quantidade', 'quantity', 11],
            ['Valor', 'amount', 12, MONEY], ['Pedido por', 'orderedBy', 16],
            ['Anulado por', 'cancelledBy', 16], ['Pedido inteiro', 'wholeOrder', 13],
        ],
    },
];

// Excel stores dates without a timezone: shift so the cell shows the
// local (kiosk) wall-clock time instead of UTC.
const toExcelDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
    ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    : null);

// exceljs is only loaded when someone exports (keeps it out of the main bundle)
export async function downloadSessionWorkbook(data, filename) {
    const {default: ExcelJS} = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS Ticket';
    workbook.created = new Date();

    for (const sheet of SHEETS) {
        const rows = data[sheet.key];
        if (!rows) continue;
        const ws = workbook.addWorksheet(sheet.name, {views: [{state: 'frozen', ySplit: 1}]});
        ws.columns = sheet.columns.map(([header, key, width, numFmt]) => ({
            header, key, width, ...(numFmt ? {style: {numFmt}} : {}),
        }));
        ws.getRow(1).font = {bold: true};
        const dateKeys = sheet.columns.filter((c) => c[3] === DATE).map((c) => c[1]);
        for (const row of rows) {
            const added = ws.addRow(dateKeys.reduce((r, k) => ({...r, [k]: toExcelDate(r[k])}), row));
            if (row.session === 'TOTAL') added.font = {bold: true};
        }
        if (rows.length > 0) {
            ws.autoFilter = {from: {row: 1, column: 1}, to: {row: 1, column: sheet.columns.length}};
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
