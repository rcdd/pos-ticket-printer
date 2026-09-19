import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    IconButton, InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import PrintIcon from '@mui/icons-material/Print';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import OrderService from '../services/order.service';
import PrinterService from '../services/printer.service';
import NumericTextFieldWithKeypad from '../components/Common/NumericTextFieldKeypad';
import {PaymentModalComponent} from '../components/POS/PaymentModalComponent';
import {useToast} from '../components/Common/ToastProvider';
import {useSession} from '../context/SessionContext.jsx';
import AuthService from '../services/auth.service';

const eurFmt = new Intl.NumberFormat('pt-PT', {style: 'currency', currency: 'EUR'});
const formatCents = (cents) => eurFmt.format((Number(cents) || 0) / 100);
const formatNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;
const formatTime = (value) => new Date(value).toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'});

const activeItems = (order) => (order.items ?? []).filter((item) => item.status === 'active');

// Active items in the shape /printer/print-ticket accepts (customer receipt)
const receiptItems = (orders) => orders
    .flatMap(activeItems)
    .map((item) => ({name: item.nameSnapshot, quantity: item.quantity, type: 'product'}));

// Aggregated consumption of a tab: sums quantities per product
const aggregateItems = (orders) => {
    const map = new Map();
    for (const item of orders.flatMap(activeItems)) {
        map.set(item.nameSnapshot, (map.get(item.nameSnapshot) ?? 0) + item.quantity);
    }
    return Array.from(map, ([name, quantity]) => ({name, quantity}));
};

export default function OrdersPage() {
    const {session} = useSession();
    const {pushError, pushMessage, pushNetworkError} = useToast();

    const [orders, setOrders] = useState(null);
    const [tables, setTables] = useState(null);
    const [searchNumber, setSearchNumber] = useState('');
    const [manageTableId, setManageTableId] = useState(null);

    // payment target: {kind: 'order'|'table', id, total, items, label}
    const [payTarget, setPayTarget] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isPrinted, setIsPrinted] = useState(false);
    const [invoiceId, setInvoiceId] = useState(null);

    // whole-order cancellation (admin approval)
    const [cancelTarget, setCancelTarget] = useState(null);
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const isAdmin = (AuthService.getUser()?.role || '') === 'admin';

    // order modification: the user edits the RESULTING quantities ("fica com
    // 2 cafés") and the diff is cancelled behind the scenes
    const [modifyTarget, setModifyTarget] = useState(null);
    const [keepQty, setKeepQty] = useState({}); // itemId → desired final quantity

    // move order between tables / to standalone
    const [moveTarget, setMoveTarget] = useState(null);
    const [moveNewNumber, setMoveNewNumber] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    const openModifyDialog = (order) => {
        const initial = {};
        for (const item of activeItems(order)) initial[item.id] = item.quantity;
        setKeepQty(initial);
        setModifyTarget(order);
    };

    const setItemKeepQty = (itemId, value, max) => {
        setKeepQty((prev) => ({...prev, [itemId]: Math.max(0, Math.min(max, value))}));
    };

    const load = useCallback(async () => {
        try {
            const [ordersRes, tablesRes] = await Promise.all([
                OrderService.getOrders('sent'),
                OrderService.getTables('open'),
            ]);
            setOrders(ordersRes.data);
            setTables(tablesRes.data);
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível carregar os pedidos'});
        }
    }, [pushNetworkError]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000); // fallback; o SSE trata do tempo real
        return () => clearInterval(interval);
    }, [load]);

    // Realtime: new terminal orders show up without refreshing
    useEffect(() => {
        const token = AuthService.getToken();
        if (!token || typeof EventSource === 'undefined') return undefined;

        const base = process.env.REACT_APP_API_BASE_URL || 'http://localhost:9393';
        let source;
        let retry;
        let stopped = false;

        const connect = () => {
            const current = AuthService.getToken();
            if (!current || stopped) return;
            source = new EventSource(`${base}/events?token=${encodeURIComponent(current)}`);
            source.addEventListener('order.created', load);
            source.addEventListener('order.updated', load);
            source.addEventListener('table.updated', load);
            source.onerror = () => {
                source.close();
                if (!stopped) retry = setTimeout(connect, 5000);
            };
        };

        connect();
        return () => {
            stopped = true;
            if (source) source.close();
            if (retry) clearTimeout(retry);
        };
    }, [load]);

    // ---- table view: joins open tabs with their unpaid orders ----
    const tableCards = useMemo(() => {
        if (tables === null || orders === null) return null;

        const byTable = new Map();
        for (const order of orders) {
            if (!order.tableId) continue;
            const list = byTable.get(order.tableId) ?? [];
            list.push(order);
            byTable.set(order.tableId, list);
        }

        let cards = tables.map((table) => {
            const tableOrders = (byTable.get(table.id) ?? []).sort((a, b) => a.number - b.number);
            return {
                table,
                orders: tableOrders,
                items: aggregateItems(tableOrders),
                lastAt: tableOrders.length ? tableOrders[tableOrders.length - 1].createdAt : null,
            };
        });

        const term = searchNumber.trim();
        if (term) {
            const wanted = String(parseInt(term, 10));
            cards = cards.filter((card) => String(card.table.number) === wanted);
        }
        return cards;
    }, [tables, orders, searchNumber]);

    const standaloneOrders = useMemo(
        () => (orders ?? []).filter((order) => !order.tableId),
        [orders],
    );

    // the manage modal always reads current state; if the tab gets closed
    // in the meantime (paid elsewhere), the modal closes itself
    const manageCard = useMemo(
        () => (manageTableId && tableCards ? tableCards.find((c) => c.table.id === manageTableId) ?? null : null),
        [manageTableId, tableCards],
    );

    useEffect(() => {
        if (manageTableId && tableCards !== null && !manageCard) {
            setManageTableId(null);
        }
    }, [manageTableId, tableCards, manageCard]);

    const startPayTable = (card) => {
        if (card.orders.length === 0) return;
        setIsPrinted(false);
        setInvoiceId(null);
        setPayTarget({
            kind: 'table',
            id: card.table.id,
            total: card.table.unpaidTotal,
            items: receiptItems(card.orders),
            label: `Mesa ${card.table.displayName || card.table.number}`,
        });
    };

    const startPayOrder = (order) => {
        setIsPrinted(false);
        setInvoiceId(null);
        setPayTarget({
            kind: 'order',
            id: order.id,
            total: order.total,
            items: receiptItems([order]),
            label: `Pedido ${formatNumber(order.number)}`,
        });
    };

    const handlePay = async (status, finalAmount, discount, paymentMethod, openDrawer) => {
        if (!status) {
            setPayTarget(null);
            return;
        }
        if (!payTarget) return;

        try {
            setIsPrinting(true);

            const payload = {paymentMethod, discount};
            const {data} = payTarget.kind === 'table'
                ? await OrderService.payTable(payTarget.id, payload)
                : await OrderService.pay(payTarget.id, payload);

            // Customer receipt (best-effort — the payment is already recorded)
            try {
                await PrinterService.printTicket({
                    items: payTarget.items,
                    totalAmount: (finalAmount / 100).toFixed(2),
                    openDrawer,
                    // product tickets already went out when the order reached
                    // the kitchen — payment prints the total only
                    printType: 'totals',
                    receiptTitle: `Conta - ${payTarget.label}:`,
                });
            } catch (printError) {
                pushError('Pagamento registado, mas o recibo não foi impresso.');
                console.error(printError?.response?.data || printError);
            }

            setInvoiceId(data.invoiceId);
            setIsPrinted(true);
            pushMessage('success', `${payTarget.label} pago — fatura nº ${data.invoiceId}.`);
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível registar o pagamento'});
        } finally {
            setIsPrinting(false);
        }
    };

    const closePayModal = () => {
        const wasPaid = isPrinted;
        setPayTarget(null);
        setIsPrinted(false);
        setInvoiceId(null);
        if (wasPaid) load();
    };

    // diff between the current order and the desired result: what to cancel
    const modifyDiff = useMemo(() => {
        if (!modifyTarget) return {items: [], removedCount: 0, isEverything: false, summary: []};
        const active = activeItems(modifyTarget);
        const items = active
            .map((item) => ({id: item.id, quantity: item.quantity - (keepQty[item.id] ?? item.quantity)}))
            .filter((entry) => entry.quantity > 0);
        const isEverything = active.length > 0 && active.every((item) => (keepQty[item.id] ?? 0) === 0);
        const summary = active
            .filter((item) => (keepQty[item.id] ?? item.quantity) > 0)
            .map((item) => `${keepQty[item.id] ?? item.quantity}× ${item.nameSnapshot}`);
        return {items, removedCount: items.reduce((acc, entry) => acc + entry.quantity, 0), isEverything, summary};
    }, [modifyTarget, keepQty]);

    const closeApprovalDialogs = () => {
        setCancelTarget(null);
        setModifyTarget(null);
        setAdminUsername('');
        setAdminPassword('');
    };

    const confirmCancelOrder = async () => {
        if (!cancelTarget || isCancelling) return;
        setIsCancelling(true);
        try {
            const body = {all: true};
            if (!isAdmin) {
                body.adminUsername = adminUsername;
                body.adminPassword = adminPassword;
            }
            const {data} = await OrderService.cancelItems(cancelTarget.id, body);
            pushMessage('success', `Pedido ${formatNumber(cancelTarget.number)} anulado.`);
            if (!data.voidPrinted) {
                pushError(`Talão de anulação não impresso${data.voidPrintError ? `: ${data.voidPrintError}` : '.'}`);
            }
            closeApprovalDialogs();
            load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível anular o pedido'});
        } finally {
            setIsCancelling(false);
        }
    };

    const confirmModify = async () => {
        if (!modifyTarget || isCancelling || modifyDiff.removedCount === 0) return;
        setIsCancelling(true);
        try {
            const body = modifyDiff.isEverything ? {all: true} : {items: modifyDiff.items};
            if (!isAdmin) {
                body.adminUsername = adminUsername;
                body.adminPassword = adminPassword;
            }
            const {data} = await OrderService.cancelItems(modifyTarget.id, body);
            pushMessage('success', modifyDiff.isEverything
                ? `Pedido ${formatNumber(modifyTarget.number)} anulado.`
                : `Pedido ${formatNumber(modifyTarget.number)} modificado — fica: ${modifyDiff.summary.join(', ')}.`);
            if (!data.voidPrinted) {
                pushError(`Talão de anulação não impresso${data.voidPrintError ? `: ${data.voidPrintError}` : '.'}`);
            }
            closeApprovalDialogs();
            load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível modificar o pedido'});
        } finally {
            setIsCancelling(false);
        }
    };

    const moveOrderTo = async (body) => {
        if (!moveTarget || isMoving) return;
        setIsMoving(true);
        try {
            const {data} = await OrderService.moveOrder(moveTarget.id, body);
            pushMessage('success', `Pedido ${formatNumber(moveTarget.number)} movido: ${data.fromLabel} → ${data.toLabel}.`);
            if (!data.movePrinted) {
                pushError(`Talão de correção não impresso${data.movePrintError ? `: ${data.movePrintError}` : '.'} Avise a cozinha/bar.`);
            }
            setMoveTarget(null);
            setMoveNewNumber('');
            load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível mover o pedido'});
        } finally {
            setIsMoving(false);
        }
    };

    const reprintOrder = async (order) => {
        try {
            const {data} = await OrderService.reprint(order.id);
            if (data.printed) {
                pushMessage('success', `Talão do pedido ${formatNumber(order.number)} impresso.`);
            } else {
                pushError(`Não imprimiu: ${data.printError || 'erro desconhecido'}`);
            }
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível reimprimir'});
        }
    };

    const closeEmptyTable = async (card) => {
        try {
            await OrderService.closeTableEmpty(card.table.id);
            pushMessage('success', `Mesa ${card.table.displayName} fechada.`);
            load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível fechar a mesa'});
        }
    };

    // one order's block inside the manage modal: full items + actions
    const orderBlock = (order) => (
        <Box key={order.id} sx={{py: 1.5}}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography fontWeight={700}>{formatNumber(order.number)}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{flex: 1}} noWrap>
                    {formatTime(order.createdAt)}
                    {order.user ? ` · ${order.user.name || order.user.username}` : ''}
                </Typography>
                {!order.printedAt && <Chip size="small" color="warning" label="talão não impresso"/>}
                <Button size="small" onClick={() => reprintOrder(order)} startIcon={<PrintIcon/>}>2ª via</Button>
                <Button size="small" onClick={() => setMoveTarget(order)} startIcon={<SwapHorizIcon/>}>Mover</Button>
                <Button size="small" onClick={() => openModifyDialog(order)} startIcon={<EditIcon/>}>Modificar</Button>
                <Button size="small" color="error" onClick={() => setCancelTarget(order)}>Anular</Button>
            </Stack>
            {(order.items ?? []).map((item) => (
                <Stack key={item.id} direction="row" sx={{pl: 1, py: 0.25}}>
                    <Typography variant="body2" sx={{
                        flex: 1,
                        textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                        color: item.status === 'cancelled' ? 'text.disabled' : 'text.primary',
                    }}>
                        {item.quantity}× {item.nameSnapshot}
                    </Typography>
                    <Typography variant="body2" sx={{
                        textDecoration: item.status === 'cancelled' ? 'line-through' : 'none',
                        color: item.status === 'cancelled' ? 'text.disabled' : 'text.primary',
                    }}>
                        {formatCents(item.price * item.quantity)}
                    </Typography>
                </Stack>
            ))}
            {order.note && (
                <Typography variant="body2" color="text.secondary" sx={{pl: 1}}>
                    Obs: {order.note}
                </Typography>
            )}
        </Box>
    );

    if (!session) {
        return (
            <Box sx={{p: 3, textAlign: 'center'}}>
                <PointOfSaleIcon sx={{fontSize: 48, color: 'text.disabled'}}/>
                <Typography variant="h6">A caixa está fechada</Typography>
                <Typography color="text.secondary">
                    Abra uma sessão para receber e cobrar pedidos dos terminais.
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction={{xs: 'column', lg: 'row'}} spacing={3} alignItems="flex-start">
                {/* ================= TABLES (the protagonists) ================= */}
                <Box sx={{flex: 3, width: '100%'}}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
                        <TableRestaurantIcon color="primary" fontSize="large"/>
                        <Typography variant="h5" sx={{flex: 1}}>Mesas</Typography>
                        <NumericTextFieldWithKeypad
                            value={searchNumber}
                            onChange={setSearchNumber}
                            maxLength={4}
                            textFieldProps={{
                                placeholder: 'Nº da mesa',
                                size: 'small',
                                sx: {width: 170},
                                InputProps: {
                                    size: 'small',
                                    startAdornment: <InputAdornment position="start">Mesa</InputAdornment>,
                                },
                            }}
                        />
                    </Stack>

                    {tableCards === null ? (
                        <CircularProgress/>
                    ) : tableCards.length === 0 ? (
                        <Typography color="text.secondary">
                            {searchNumber ? 'Nenhuma conta aberta nessa mesa.' : 'Não há mesas abertas.'}
                        </Typography>
                    ) : (
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: {xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)'},
                            gap: 2,
                        }}>
                            {tableCards.map((card) => {
                                const hasOrders = card.orders.length > 0;
                                return (
                                    <Card key={card.table.id} variant="outlined"
                                          sx={{display: 'flex', flexDirection: 'column'}}>
                                        <CardContent sx={{flex: 1, pb: 1}}>
                                            <Stack direction="row" alignItems="baseline" spacing={1}>
                                                <Typography variant="h4" fontWeight={800} color="primary">
                                                    {card.table.displayName || card.table.number}
                                                </Typography>
                                                <Box sx={{flex: 1}}/>
                                                <Typography variant="h5" fontWeight={700}>
                                                    {hasOrders ? formatCents(card.table.unpaidTotal) : '—'}
                                                </Typography>
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary">
                                                {hasOrders
                                                    ? `${card.orders.length} pedido(s) · último às ${formatTime(card.lastAt)}`
                                                    : 'Sem consumo'}
                                                {card.table.openedBy
                                                    ? ` · aberta por ${card.table.openedBy.name || card.table.openedBy.username}`
                                                    : ''}
                                            </Typography>

                                            {hasOrders && (
                                                <Box sx={{mt: 1}}>
                                                    {card.items.slice(0, 5).map((item) => (
                                                        <Typography key={item.name} variant="body2" noWrap>
                                                            <b>{item.quantity}×</b> {item.name}
                                                        </Typography>
                                                    ))}
                                                    {card.items.length > 5 && (
                                                        <Typography variant="body2" color="text.secondary">
                                                            +{card.items.length - 5} produto(s)…
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </CardContent>

                                        <Stack direction="row" spacing={1} sx={{p: 1.5, pt: 0}}>
                                            {hasOrders ? (
                                                <>
                                                    <Button size="small"
                                                            onClick={() => setManageTableId(card.table.id)}>
                                                        Detalhes
                                                    </Button>
                                                    <Box sx={{flex: 1}}/>
                                                    <Button variant="contained" size="large"
                                                            onClick={() => startPayTable(card)}>
                                                        Pagar {formatCents(card.table.unpaidTotal)}
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Box sx={{flex: 1}}/>
                                                    <Button size="small" color="inherit"
                                                            onClick={() => closeEmptyTable(card)}>
                                                        Fechar mesa
                                                    </Button>
                                                </>
                                            )}
                                        </Stack>
                                    </Card>
                                );
                            })}
                        </Box>
                    )}
                </Box>

                {/* ================= STANDALONE ORDERS (secondary) ================= */}
                <Box sx={{flex: 1, width: '100%', minWidth: {lg: 300}}}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 2}}>
                        <ReceiptLongIcon color="primary"/>
                        <Typography variant="h6">Pedidos avulsos</Typography>
                    </Stack>

                    {orders === null ? (
                        <CircularProgress/>
                    ) : standaloneOrders.length === 0 ? (
                        <Typography color="text.secondary">Não há avulsos por pagar.</Typography>
                    ) : (
                        <Stack spacing={1.5}>
                            {standaloneOrders.map((order) => (
                                <Card key={order.id} variant="outlined">
                                    <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography variant="h6" fontWeight={700} color="primary">
                                                {formatNumber(order.number)}
                                            </Typography>
                                            {!order.printedAt &&
                                                <Chip size="small" color="warning" label="não impresso"/>}
                                            <Box sx={{flex: 1}}/>
                                            <Typography fontWeight={700}>{formatCents(order.total)}</Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTime(order.createdAt)}
                                            {order.user ? ` · ${order.user.name || order.user.username}` : ''}
                                        </Typography>
                                        <Box sx={{mt: 0.5, mb: 1}}>
                                            {activeItems(order).map((item) => (
                                                <Typography key={item.id} variant="body2" noWrap>
                                                    <b>{item.quantity}×</b> {item.nameSnapshot}
                                                </Typography>
                                            ))}
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                            <Button size="small" onClick={() => reprintOrder(order)}
                                                    startIcon={<PrintIcon/>}>2ª via</Button>
                                            <Button size="small"
                                                    onClick={() => setMoveTarget(order)}
                                                    startIcon={<SwapHorizIcon/>}>Mover</Button>
                                            <Button size="small"
                                                    onClick={() => openModifyDialog(order)}
                                                    startIcon={<EditIcon/>}>Modificar</Button>
                                            <Button size="small" color="error"
                                                    onClick={() => setCancelTarget(order)}>Anular</Button>
                                            <Box sx={{flex: 1}}/>
                                            <Button variant="contained" size="small"
                                                    onClick={() => startPayOrder(order)}>
                                                Pagar
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>
            </Stack>

            <Divider sx={{my: 3}}/>
            <Typography variant="body2" color="text.secondary">
                Os pedidos chegam dos terminais (telemóveis/tablets). O pagamento converte-os numa venda normal,
                visível nos relatórios e na tesouraria.
            </Typography>

            <Dialog open={Boolean(manageCard)} onClose={() => setManageTableId(null)} fullWidth maxWidth="sm">
                {manageCard && (
                    <>
                        <DialogTitle sx={{display: 'flex', alignItems: 'baseline', gap: 1, pr: 6}}>
                            <span>Mesa <b>{manageCard.table.displayName || manageCard.table.number}</b></span>
                            <Typography variant="body2" color="text.secondary" sx={{flex: 1}}>
                                {manageCard.orders.length} pedido(s)
                                {manageCard.table.openedBy
                                    ? ` · aberta por ${manageCard.table.openedBy.name || manageCard.table.openedBy.username}`
                                    : ''}
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                                {formatCents(manageCard.table.unpaidTotal)}
                            </Typography>
                            <IconButton
                                aria-label="fechar"
                                onClick={() => setManageTableId(null)}
                                sx={{position: 'absolute', right: 8, top: 8}}
                            >
                                <CloseIcon/>
                            </IconButton>
                        </DialogTitle>
                        <DialogContent dividers>
                            {manageCard.orders.map((order, index) => (
                                <React.Fragment key={order.id}>
                                    {index > 0 && <Divider/>}
                                    {orderBlock(order)}
                                </React.Fragment>
                            ))}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setManageTableId(null)}>Fechar</Button>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => {
                                    startPayTable(manageCard);
                                    setManageTableId(null);
                                }}
                            >
                                Pagar {formatCents(manageCard.table.unpaidTotal)}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            <Dialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle>Anular pedido {cancelTarget ? formatNumber(cancelTarget.number) : ''}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{mb: 2}}>
                        Todos os itens ficam anulados e é impresso um talão de anulação para a
                        cozinha/bar. Esta ação fica registada. Para corrigir apenas quantidades,
                        use "Modificar".
                    </DialogContentText>
                    {!isAdmin && (
                        <Stack spacing={2}>
                            <DialogContentText>Requer aprovação de um administrador:</DialogContentText>
                            <TextField label="Utilizador admin" size="small" value={adminUsername}
                                       onChange={(e) => setAdminUsername(e.target.value)}/>
                            <TextField label="Palavra-passe" type="password" size="small" value={adminPassword}
                                       onChange={(e) => setAdminPassword(e.target.value)}/>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={() => setCancelTarget(null)}>Voltar</Button>
                    <Button variant="contained" color="error" onClick={confirmCancelOrder}
                            disabled={isCancelling || (!isAdmin && (!adminUsername || !adminPassword))}>
                        Anular pedido
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(modifyTarget)} onClose={() => setModifyTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle>Modificar pedido {modifyTarget ? formatNumber(modifyTarget.number) : ''}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{mb: 1.5}}>
                        Ajuste as quantidades para o que o pedido <b>deve ficar</b>. A diferença é
                        anulada e impressa para a cozinha/bar.
                    </DialogContentText>
                    <Stack spacing={0.5} sx={{mb: 1.5}}>
                        {modifyTarget && activeItems(modifyTarget).map((item) => {
                            const qty = keepQty[item.id] ?? item.quantity;
                            const changed = qty !== item.quantity;
                            return (
                                <Stack key={item.id} direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="body2" sx={{flex: 1}} noWrap
                                                color={qty === 0 ? 'text.disabled' : 'text.primary'}
                                                style={{textDecoration: qty === 0 ? 'line-through' : 'none'}}>
                                        {item.nameSnapshot}
                                    </Typography>
                                    {changed && (
                                        <Typography variant="caption" color="text.disabled"
                                                    style={{textDecoration: 'line-through'}}>
                                            {item.quantity}
                                        </Typography>
                                    )}
                                    <IconButton size="small" disabled={qty <= 0}
                                                onClick={() => setItemKeepQty(item.id, qty - 1, item.quantity)}>
                                        <RemoveIcon fontSize="small"/>
                                    </IconButton>
                                    <Typography variant="body2" fontWeight={700}
                                                color={changed ? 'warning.main' : 'text.primary'}
                                                sx={{width: 24, textAlign: 'center'}}>
                                        {qty}
                                    </Typography>
                                    <IconButton size="small" disabled={qty >= item.quantity}
                                                onClick={() => setItemKeepQty(item.id, qty + 1, item.quantity)}>
                                        <AddIcon fontSize="small"/>
                                    </IconButton>
                                </Stack>
                            );
                        })}
                    </Stack>
                    {modifyDiff.removedCount > 0 && (
                        <DialogContentText sx={{mb: 1.5}}>
                            {modifyDiff.isEverything
                                ? 'Fica: pedido totalmente anulado.'
                                : `Fica: ${modifyDiff.summary.join(', ')}.`}
                        </DialogContentText>
                    )}
                    {!isAdmin && (
                        <Stack spacing={2}>
                            <DialogContentText>Requer aprovação de um administrador:</DialogContentText>
                            <TextField label="Utilizador admin" size="small" value={adminUsername}
                                       onChange={(e) => setAdminUsername(e.target.value)}/>
                            <TextField label="Palavra-passe" type="password" size="small" value={adminPassword}
                                       onChange={(e) => setAdminPassword(e.target.value)}/>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={() => setModifyTarget(null)}>Voltar</Button>
                    <Button variant="contained" color="warning" onClick={confirmModify}
                            disabled={isCancelling || modifyDiff.removedCount === 0 || (!isAdmin && (!adminUsername || !adminPassword))}>
                        Guardar alterações
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(moveTarget)} onClose={() => setMoveTarget(null)} fullWidth maxWidth="xs">
                <DialogTitle>
                    Mover pedido {moveTarget ? formatNumber(moveTarget.number) : ''}
                    <Typography variant="body2" color="text.secondary">
                        Atualmente: {moveTarget?.table ? `Mesa ${moveTarget.table.displayName}` : 'Avulso'} —
                        é impresso um talão de correção para a cozinha/bar.
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{mb: 1}}>Mesas abertas:</DialogContentText>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{mb: 2}}>
                        {(tableCards ?? [])
                            .filter((card) => card.table.id !== moveTarget?.tableId)
                            .map((card) => (
                                <Chip
                                    key={card.table.id}
                                    clickable
                                    disabled={isMoving}
                                    label={`${card.table.displayName} · ${formatCents(card.table.unpaidTotal ?? 0)}`}
                                    onClick={() => moveOrderTo({targetTableId: card.table.id})}
                                />
                            ))}
                        {(tableCards ?? []).filter((card) => card.table.id !== moveTarget?.tableId).length === 0 && (
                            <Typography variant="body2" color="text.disabled">Nenhuma outra mesa aberta.</Typography>
                        )}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                            label="Nova mesa (nº)"
                            size="small"
                            value={moveNewNumber}
                            onChange={(e) => setMoveNewNumber(e.target.value.replace(/\D/g, ''))}
                            sx={{flex: 1}}
                        />
                        <Button
                            variant="outlined"
                            disabled={isMoving || !moveNewNumber}
                            onClick={() => moveOrderTo({newTableNumber: moveNewNumber})}
                        >
                            Criar e mover
                        </Button>
                    </Stack>
                    {moveTarget?.tableId && (
                        <Button
                            sx={{mt: 2}}
                            fullWidth
                            variant="outlined"
                            disabled={isMoving}
                            onClick={() => moveOrderTo({toStandalone: true})}
                        >
                            Mover para avulso (pagar ao balcão)
                        </Button>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMoveTarget(null)} disabled={isMoving}>Fechar</Button>
                </DialogActions>
            </Dialog>

            <PaymentModalComponent
                openModal={Boolean(payTarget)}
                totalAmount={payTarget?.total ?? 0}
                invoiceId={invoiceId}
                isPrinted={isPrinted}
                isPrinting={isPrinting}
                handlePrint={handlePay}
                handleModalClose={closePayModal}
            />
        </Box>
    );
}
