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

// Itens ativos no formato aceite por /printer/print-ticket (recibo do cliente)
const receiptItems = (orders) => orders
    .flatMap(activeItems)
    .map((item) => ({name: item.nameSnapshot, quantity: item.quantity, type: 'product'}));

// Consumo agregado de uma conta: soma quantidades por produto
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

    // alvo do pagamento: {kind: 'order'|'table', id, total, items, label}
    const [payTarget, setPayTarget] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isPrinted, setIsPrinted] = useState(false);
    const [invoiceId, setInvoiceId] = useState(null);

    // anulação de pedido inteiro (aprovação admin)
    const [cancelTarget, setCancelTarget] = useState(null);
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const isAdmin = (AuthService.getUser()?.role || '') === 'admin';

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

    // Tempo real: pedidos novos dos terminais aparecem sem refrescar
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

    // ---- vista por mesa: junta contas abertas com os seus pedidos por pagar ----
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

    // a modal de gestão lê sempre do estado atual; se a conta fechar
    // entretanto (paga noutro lado), a modal fecha-se sozinha
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

            // Recibo para o cliente (best-effort — o pagamento já está registado)
            try {
                await PrinterService.printTicket({
                    items: payTarget.items,
                    totalAmount: (finalAmount / 100).toFixed(2),
                    openDrawer,
                    // as senhas dos produtos já saíram quando o pedido chegou
                    // à cozinha — no pagamento imprime-se apenas o total
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
            setCancelTarget(null);
            setAdminUsername('');
            setAdminPassword('');
            load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível anular o pedido'});
        } finally {
            setIsCancelling(false);
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

    // bloco de um pedido dentro da modal de gestão: itens completos + ações
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
                {/* ================= MESAS (protagonistas) ================= */}
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

                {/* ================= AVULSOS (secundário) ================= */}
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
                        Todos os itens ficam anulados e é impresso um talão de anulação para a cozinha.
                        Esta ação fica registada.
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
