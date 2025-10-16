import React from 'react';
import {
    Box,
    Paper,
    Stack,
    Typography,
    Button,
    Chip,
    Divider,
    IconButton,
    Toolbar,
    TextField,
    MenuItem,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Drawer,
    Card,
    CardContent,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Grid,
    Skeleton,
    TableContainer
} from '@mui/material';
import {DataGrid} from '@mui/x-data-grid';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCardIcon from '@mui/icons-material/AddCard';
import PaymentsIcon from '@mui/icons-material/Payments';

import InvoiceService from '../../services/invoice.service';
import SessionService from '../../services/session.service';
import CashMovementService from '../../services/cashMovement.service';
import PrinterService from '../../services/printer.service';
import UserService from '../../services/user.service';
import {PaymentMethods} from '../../enums/PaymentMethodsEnum';
import {useToast} from "../../components/Common/ToastProvider";
import {computeSessionAggregates} from "../../utils/sessionAggregates";

function ReportsPage() {
    // data
    const [sessions, setSessions] = React.useState([]);
    const [invoices, setInvoices] = React.useState([]);

    const {pushNetworkError, pushMessage} = useToast();
    const userNameCacheRef = React.useRef(new Map());

    // ui
    const [loading, setLoading] = React.useState(true);
    const [tab, setTab] = React.useState('invoices'); // 'sessions' | 'invoices' | 'products'
    const [viewInvoice, setViewInvoice] = React.useState(null);
    const [revokeDialog, setRevokeDialog] = React.useState(null);

    // new: session drawer
    const [viewSession, setViewSession] = React.useState(null);
    const [sessionMovements, setSessionMovements] = React.useState(null); // { list, cashIn, cashOut, net, cashSales, finalCash }
    const [sessionDrawerLoading, setSessionDrawerLoading] = React.useState(false);
    const [printingSession, setPrintingSession] = React.useState(false);

    const resolveUserName = React.useCallback(async (id) => {
        if (!id) return "Desconhecido";
        if (userNameCacheRef.current.has(id)) {
            return userNameCacheRef.current.get(id);
        }
        try {
            const res = await UserService.get(id);
            const data = res?.data ?? res;
            const name = data?.name?.trim() || data?.username?.trim() || "Desconhecido";
            userNameCacheRef.current.set(id, name);
            return name;
        } catch (error) {
            console.error("Falha ao obter utilizador:", error?.response?.data || error);
            userNameCacheRef.current.set(id, "Desconhecido");
            return "Desconhecido";
        }
    }, []);

    // filters
    const [dateFrom, setDateFrom] = React.useState('');
    const [dateTo, setDateTo] = React.useState('');
    const [sessionId, setSessionId] = React.useState('all');
    const [paymentFilter, setPaymentFilter] = React.useState('all');
    const [statusFilter, setStatusFilter] = React.useState('all'); // invoices: all|active|revoked

    // fetch
    const fetchAll = React.useCallback(async () => {
        setLoading(true);
        try {
            const [ss, inv] = await Promise.all([
                SessionService.getAll(),
                InvoiceService.getInvoices(),
            ]);
            setSessions(ss?.data ?? []);
            setInvoices(Array.isArray(inv) ? inv : inv?.data ?? []);
        } catch (e) {
            console.error('Failed to fetch reports:', e?.response?.data || e);
            setSessions([]);
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const eur = React.useMemo(
        () => (cents) => (Number(cents || 0) / 100).toLocaleString('pt-PT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €',
        []
    );

    // filter invoices
    const filteredInvoices = React.useMemo(() => {
        return (invoices ?? []).filter((inv) => {
            if (sessionId !== 'all' && String(inv.sessionId) !== String(sessionId)) return false;
            if (paymentFilter !== 'all' && inv.paymentMethod !== paymentFilter) return false;
            if (statusFilter === 'active' && inv.isDeleted) return false;
            if (statusFilter === 'revoked' && !inv.isDeleted) return false;
            if (dateFrom) {
                const f = new Date(dateFrom + 'T00:00');
                if (new Date(inv.createdAt) < f) return false;
            }
            if (dateTo) {
                const t = new Date(dateTo + 'T23:59:59');
                if (new Date(inv.createdAt) > t) return false;
            }
            return true;
        });
    }, [invoices, sessionId, paymentFilter, statusFilter, dateFrom, dateTo]);

    // summary for invoices
    const summary = React.useMemo(() => {
        const total = filteredInvoices
            .filter(inv => !inv.isDeleted)
            .reduce((sum, inv) => sum + (inv.total || 0), 0);
        const byMethod = filteredInvoices
            .filter(inv => !inv.isDeleted)
            .reduce((map, v) => {
                const k = v.paymentMethod || 'unknown';
                map[k] = (map[k] || 0) + (v.total || 0);
                return map;
            }, {});
        const count = filteredInvoices.length;
        const revoked = filteredInvoices.filter(i => i.isDeleted).length;
        return {total, byMethod, count, revoked};
    }, [filteredInvoices]);

    const productsAgg = React.useMemo(() => {
        const map = new Map();
        for (const inv of filteredInvoices) {
            const disc = inv?.discountPercent || 0;
            for (const r of inv?.records ?? []) {
                const item = r.productItem || r.menuItem;
                if (!item) continue;
                const id = r.productItem ? `p-${item.id}` : `m-${item.id}`;
                const key = `${id}-${disc}`;
                const price = item.price || 0;
                const unit = disc > 0 ? Math.round(price * (1 - disc / 100)) : price;
                const prev = map.get(key) ?? {
                    id: key,
                    zone: (item.zone?.name || '—') + (item.zone?.isDeleted ? ' (Eliminado)' : ''),
                    kind: r.productItem ? 'Produto' : 'Menu',
                    itemId: item.id,
                    name: item.name + (item.isDeleted ? ' (Eliminado)' : ''),
                    discount: disc,
                    quantity: 0,
                    unit,
                    total: 0,
                };
                prev.quantity += r.quantity || 0;
                prev.total += unit * (r.quantity || 0);
                map.set(key, prev);
            }
        }
        return Array.from(map.values());
    }, [filteredInvoices]);

    const sessionsRows = React.useMemo(() => {
        const bySession = new Map();
        for (const inv of invoices) {
            const sid = inv.sessionId;
            if (sid == null) continue;
            const acc = bySession.get(sid) ?? {total: 0, cash: 0, card: 0, mbway: 0, count: 0, revoked: 0};
            // Considerar apenas faturas válidas para totais
            if (!inv.isDeleted) {
                acc.total += inv.total || 0;
                if (inv.paymentMethod === 'cash') acc.cash += inv.total || 0;
                if (inv.paymentMethod === 'card') acc.card += inv.total || 0;
                if (inv.paymentMethod === 'mbway') acc.mbway += inv.total || 0;
            }
            acc.count += 1;
            if (inv.isDeleted) acc.revoked += 1;
            bySession.set(sid, acc);
        }
        return (sessions ?? []).map((s) => {
            const agg = bySession.get(s.id) ?? {total: 0, cash: 0, card: 0, mbway: 0, count: 0, revoked: 0};
            return {
                id: s.id,
                openedAt: s.openedAt,
                closedAt: s.closedAt,
                status: s.status,
                initialAmount: s.initialAmount || 0,
                invoices: agg.count,
                revoked: agg.revoked,
                total: agg.total,
                cash: agg.cash,
                card: agg.card,
                mbway: agg.mbway,
            };
        });
    }, [sessions, invoices]);

    // export helpers
    const downloadCSV = (filename, rows, columns) => {
        const headers = columns.map(c => c.headerName ?? c.field);
        const lines = rows.map(r => columns.map(c => {
            const val = typeof c.valueGetter === 'function' ? c.valueGetter(r[c.field], r) :
                typeof c.valueFormatter === 'function' ? c.valueFormatter(r[c.field], r) :
                    r[c.field];
            const s = String(val ?? '');
            return `"${s.replace(/"/g, '""')}"`;
        }).join(','));
        const csv = [headers.join(','), ...lines].join('\n');
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sessionsCols = [
        {field: 'id', headerName: 'Sessão', width: 110},
        {
            field: 'openedAt', headerName: 'Início', minWidth: 160, flex: 1,
            valueFormatter: (v) => v ? new Date(v).toLocaleString('pt-PT') : '—'
        },
        {
            field: 'closedAt', headerName: 'Fecho', minWidth: 160, flex: 1,
            valueFormatter: (v) => v ? new Date(v).toLocaleString('pt-PT') : '—'
        },
        {
            field: 'status', headerName: 'Estado', width: 120,
            renderCell: (p) => (
                <Chip size="small" color={p.value === 'opened' ? 'success' : 'default'}
                      label={p.value === 'opened' ? 'Aberta' : 'Fechada'}/>
            )
        },
        {field: 'initialAmount', headerName: 'Abertura', width: 120, valueFormatter: (v) => eur(v)},
        {field: 'invoices', headerName: 'Faturas', width: 110},
        {field: 'revoked', headerName: 'Anuladas', width: 110},
        {field: 'total', headerName: 'Total', width: 140, valueFormatter: (v) => eur(v)},
        {field: 'cash', headerName: 'Dinheiro', width: 120, valueFormatter: (v) => eur(v)},
        {field: 'card', headerName: 'Multibanco', width: 130, valueFormatter: (v) => eur(v)},
        {field: 'mbway', headerName: 'MB Way', width: 120, valueFormatter: (v) => eur(v)},
        {
            field: 'action', headerName: 'Ver', width: 90, sortable: false, filterable: false,
            renderCell: (params) => (
                <Tooltip title="Ver sessão">
                    <IconButton size="small" onClick={() => openSessionDrawer(params.row.id)}>
                        <VisibilityIcon fontSize="small"/>
                    </IconButton>
                </Tooltip>
            )
        },
    ];

    const invoicesCols = [
        {field: 'id', headerName: 'Fatura', width: 110},
        {
            field: 'createdAt', headerName: 'Data', minWidth: 170, flex: 1,
            valueFormatter: (v) => new Date(v).toLocaleString('pt-PT')
        },
        {field: 'sessionId', headerName: 'Sessão', width: 110},
        {
            field: 'paymentMethod', headerName: 'Método', width: 140,
            valueFormatter: (v) => PaymentMethods.find(m => m.id === v)?.name ?? v
        },
        {
            field: 'isDeleted', headerName: 'Estado', width: 120,
            renderCell: (p) => (
                <Chip size="small" color={p.value ? 'error' : 'success'} label={p.value ? 'Anulada' : 'Válida'}/>
            )
        },
        {field: 'total', headerName: 'Total', width: 140, valueFormatter: (v) => eur(v)},
        {
            field: 'action', headerName: 'Ver', width: 90, sortable: false, filterable: false,
            renderCell: (params) => (
                <Tooltip title="Ver fatura">
                    <IconButton size="small" onClick={() => setViewInvoice(params.row)}>
                        <VisibilityIcon fontSize="small"/>
                    </IconButton>
                </Tooltip>
            )
        },
    ];

    const productsCols = [
        {field: 'name', headerName: 'Produto/Menu', flex: 1, minWidth: 220},
        {field: 'zone', headerName: 'Zona', width: 110},
        {field: 'kind', headerName: 'Tipo', width: 110},
        {field: 'discount', headerName: 'Desc. (%)', width: 110},
        {field: 'quantity', headerName: 'Qt.', width: 100},
        {field: 'unit', headerName: 'Preço (un)', width: 130, valueFormatter: (v) => eur(v)},
        {field: 'total', headerName: 'Total', width: 140, valueFormatter: (v) => eur(v)},
    ];

    const resetFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSessionId('all');
        setPaymentFilter('all');
        setStatusFilter('all');
    };

    // ----- Session Drawer logic -----
    const openSessionDrawer = async (id) => {
        const s = sessions.find(x => String(x.id) === String(id));
        setViewSession(s || {id});
    };

    React.useEffect(() => {
        const load = async () => {
            if (!viewSession?.id) return;
            setSessionDrawerLoading(true);
            try {
                // movimentos de caixa
                const list = await CashMovementService.getFromSession(viewSession.id);
                const movements = Array.isArray(list) ? list : list?.data ?? [];

                // faturas desta sessão (válidas)
                const invOfSession = (invoices || []).filter(i => String(i.sessionId) === String(viewSession.id));

                const aggregates = computeSessionAggregates(
                    invOfSession,
                    Number(viewSession.initialAmount || 0),
                    movements
                );

                const byMethod = (aggregates.paymentsAgg || []).reduce((map, entry) => {
                    const method = entry?.method || 'unknown';
                    const amount = Number(entry?.amount || 0);
                    map[method] = (map[method] || 0) + amount;
                    return map;
                }, {});

                const cashSales = byMethod['cash'] || 0;

                setSessionMovements({
                    list: movements,
                    cashIn: aggregates.cashIn,
                    cashOut: aggregates.cashOut,
                    net: aggregates.netAdjustments,
                    cashSales,
                    finalCash: aggregates.finalCashValueCents,
                    byMethod,
                    productsAgg: aggregates.productsAgg,
                    discountedProductsAgg: aggregates.discountedProductsAgg,
                });
            } catch (e) {
                console.error('Failed to load session drawer data:', e?.response?.data || e);
                setSessionMovements(null);
            } finally {
                setSessionDrawerLoading(false);
            }
        };
        load();
    }, [viewSession?.id, invoices, viewSession?.initialAmount]);

    const handleReprintSession = React.useCallback(async () => {
        if (!viewSession?.id) return;
        if (sessionDrawerLoading || printingSession) return;

        const cashMovements = sessionMovements?.list ?? [];
        const sessionInvoices = (invoices || []).filter(
            (inv) => String(inv.sessionId) === String(viewSession.id)
        );

        setPrintingSession(true);
        try {
            const {
                totalAmountCents,
                paymentsAgg,
                productsAgg,
                discountedProductsAgg,
                finalCashValueCents,
            } = computeSessionAggregates(
                sessionInvoices,
                Number(viewSession.initialAmount || 0),
                cashMovements
            );

            const [userOpenName, userCloseName] = await Promise.all([
                resolveUserName(viewSession.userOpenId),
                resolveUserName(viewSession.userCloseId),
            ]);

            const payload = {
                userOpen: userOpenName,
                userClose: userCloseName,
                openedAt: viewSession.openedAt,
                closedAt: viewSession.closedAt || new Date().toISOString(),
                initialAmount: viewSession.initialAmount,
                totalSales: sessionInvoices.length,
                payments: paymentsAgg,
                products: productsAgg,
                discountedProducts: discountedProductsAgg.sort((a, b) => b.discount - a.discount),
                closingAmount: totalAmountCents,
                finalCashValue: finalCashValueCents,
                notes: viewSession.notes ?? '',
                cashMovements,
            };

            await PrinterService.printSessionSummary(payload);
            pushMessage("success", "Resumo enviado para impressão.");
        } catch (error) {
            console.error("Erro ao imprimir resumo da sessão:", error?.response?.data || error);
            pushNetworkError(error, {title: "Não foi possível imprimir o resumo da sessão"});
        } finally {
            setPrintingSession(false);
        }
    }, [
        viewSession,
        sessionMovements,
        invoices,
        sessionDrawerLoading,
        printingSession,
        resolveUserName,
        pushMessage,
        pushNetworkError
    ]);

    const renderProductsTable = React.useCallback(() => {
        const products = sessionMovements?.productsAgg ?? [];
        const discounted = sessionMovements?.discountedProductsAgg ?? [];

        if (!products.length && !discounted.length) {
            return <Typography variant="body2" color="text.disabled">Sem vendas registadas.</Typography>;
        }

        const grouped = products.reduce((acc, item) => {
            const key = item.zone?.name || 'Sem Zona';
            if (!acc[key]) {
                acc[key] = {
                    zone: key,
                    items: [],
                    total: 0,
                    qty: 0,
                };
            }
            acc[key].items.push(item);
            acc[key].total += item.total || 0;
            acc[key].qty += item.quantity || 0;
            return acc;
        }, {});

        const discountedGroups = discounted.reduce((acc, item) => {
            const key = item.zone?.name || 'Sem Zona';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        for (const [zoneName, items] of Object.entries(discountedGroups)) {
            if (!grouped[zoneName]) {
                grouped[zoneName] = {
                    zone: zoneName,
                    items: [],
                    total: 0,
                    qty: 0,
                };
            }
            for (const item of items) {
                grouped[zoneName].total += item.total || 0;
                grouped[zoneName].qty += item.quantity || 0;
            }
        }

        const zones = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], 'pt-PT'));

        return (
            <TableContainer sx={{maxHeight: 260}}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell width={160}>Zona</TableCell>
                            <TableCell>Produto</TableCell>
                            <TableCell align="right">Qt.</TableCell>
                            <TableCell align="right">Total</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {zones.map(([zoneName, data]) => (
                            <React.Fragment key={`zone-${zoneName}`}>
                                <TableRow sx={{backgroundColor: 'action.hover'}}>
                                    <TableCell colSpan={2} sx={{fontWeight: 700}}>{zoneName}</TableCell>
                                    <TableCell align="right" sx={{fontWeight: 700}}>{data.qty}</TableCell>
                                    <TableCell align="right" sx={{fontWeight: 700}}>{eur(data.total)}</TableCell>
                                </TableRow>
                                {data.items.map((item) => (
                                    <TableRow key={`item-${zoneName}-${item.id}`}>
                                        <TableCell/>
                                        <TableCell>
                                            {item.name}{item.isDeleted ? ' (Eliminado)' : ''}
                                        </TableCell>
                                        <TableCell align="right">{item.quantity}</TableCell>
                                        <TableCell align="right">{eur(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                                {(discountedGroups[zoneName] || []).map((item) => (
                                    <TableRow key={`disc-${zoneName}-${item.id}-${item.discount}`}>
                                        <TableCell/>
                                        <TableCell>
                                            {item.name}{item.isDeleted ? ' (Eliminado)' : ''}{' '}
                                            <Chip
                                                size="small"
                                                label={`Desconto ${item.discount}%`}
                                                color="warning"
                                                variant="outlined"
                                                sx={{ml: 1}}
                                            />
                                        </TableCell>
                                        <TableCell align="right">{item.quantity}</TableCell>
                                        <TableCell align="right">{eur(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }, [sessionMovements, eur]);

    return (
        <Stack spacing={2}>
            <Typography variant="h4">Relatórios & Movimentos</Typography>

            {/* filtros */}
            <Paper elevation={0} sx={{p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2}}>
                <Toolbar disableGutters sx={{gap: 2, flexWrap: 'wrap'}}>
                    <TextField
                        label="De"
                        type="date"
                        size="small"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        InputLabelProps={{shrink: true}}
                    />
                    <TextField
                        label="Até"
                        type="date"
                        size="small"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        InputLabelProps={{shrink: true}}
                    />
                    <TextField
                        label="Sessão"
                        select
                        size="small"
                        sx={{minWidth: 160}}
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                    >
                        <MenuItem value="all">Todas</MenuItem>
                        {sessions.map(s => (
                            <MenuItem key={s.id} value={String(s.id)}>
                                #{s.id} — {new Date(s.openedAt).toLocaleString('pt-PT')}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Método"
                        select
                        size="small"
                        sx={{minWidth: 160}}
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                    >
                        <MenuItem value="all">Todos</MenuItem>
                        {PaymentMethods.map(pm => (
                            <MenuItem key={pm.id} value={pm.id}>{pm.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label="Estado"
                        select
                        size="small"
                        sx={{minWidth: 150}}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <MenuItem value="all">Todos</MenuItem>
                        <MenuItem value="active">Válidas</MenuItem>
                        <MenuItem value="revoked">Anuladas</MenuItem>
                    </TextField>

                    <Box sx={{flexGrow: 1}}/>
                    <Tooltip title="Limpar filtros">
                        <IconButton onClick={resetFilters}>
                            <RestartAltIcon/>
                        </IconButton>
                    </Tooltip>
                </Toolbar>

                <Stack direction="row" spacing={2} sx={{mt: 1, flexWrap: 'wrap'}}>
                    <Paper sx={{p: 1.5, flex: '1 1 180px'}} variant="outlined">
                        <Typography variant="caption" color="text.secondary">Faturas</Typography>
                        <Typography variant="h6">{summary.count}</Typography>
                    </Paper>
                    <Paper sx={{p: 1.5, flex: '1 1 180px'}} variant="outlined">
                        <Typography variant="caption" color="text.secondary">Total</Typography>
                        <Typography variant="h6">{eur(summary.total)}</Typography>
                    </Paper>
                    <Paper sx={{p: 1.5, flex: '1 1 180px'}} variant="outlined">
                        <Typography variant="caption" color="text.secondary">Anuladas</Typography>
                        <Typography variant="h6">{summary.revoked}</Typography>
                    </Paper>
                    {['cash', 'card', 'mbway'].map(k => (
                        <Paper key={k} sx={{p: 1.5, flex: '1 1 180px'}} variant="outlined">
                            <Typography variant="caption" color="text.secondary">
                                {PaymentMethods.find(p => p.id === k)?.name ?? k}
                            </Typography>
                            <Typography variant="h6">{eur(summary.byMethod[k] || 0)}</Typography>
                        </Paper>
                    ))}
                </Stack>
            </Paper>

            <Paper elevation={0} sx={{p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2}}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 1}}>
                    <Stack direction="row" spacing={1}>
                        <Chip
                            label="Sessões"
                            clickable
                            color={tab === 'sessions' ? 'primary' : 'default'}
                            onClick={() => setTab('sessions')}
                        />
                        <Chip
                            label="Faturas"
                            clickable
                            color={tab === 'invoices' ? 'primary' : 'default'}
                            onClick={() => setTab('invoices')}
                        />
                        <Chip
                            label="Produtos"
                            clickable
                            color={tab === 'products' ? 'primary' : 'default'}
                            onClick={() => setTab('products')}
                        />
                    </Stack>

                    <Button
                        startIcon={<DownloadIcon/>}
                        variant="outlined"
                        onClick={() => {
                            if (tab === 'sessions') downloadCSV('sessoes.csv', sessionsRows, sessionsCols);
                            if (tab === 'invoices') downloadCSV('faturas.csv', filteredInvoices, invoicesCols);
                            if (tab === 'products') downloadCSV('produtos.csv', productsAgg, productsCols);
                        }}
                    >
                        Exportar CSV
                    </Button>
                </Stack>

                {tab === 'sessions' && (
                    <DataGrid
                        rows={sessionsRows}
                        columns={sessionsCols}
                        loading={loading}
                        disableRowSelectionOnClick
                        initialState={{
                            sorting: {
                                sortModel: [{field: 'openedAt', sort: 'desc'}],
                            },
                        }}
                        density="compact"
                    />
                )}

                {tab === 'invoices' && (
                    <DataGrid
                        rows={filteredInvoices}
                        columns={invoicesCols}
                        loading={loading}
                        disableRowSelectionOnClick
                        density="compact"
                        getRowClassName={(p) => p.row.isDeleted ? 'row--revoked' : ''}
                        initialState={{
                            sorting: {
                                sortModel: [{field: 'createdAt', sort: 'desc'}],
                            },
                        }}
                        sx={{
                            '& .row--revoked': {opacity: 0.6, textDecoration: 'line-through'},
                        }}
                    />
                )}

                {tab === 'products' && (
                    <DataGrid
                        rows={productsAgg}
                        columns={productsCols}
                        loading={loading}
                        disableRowSelectionOnClick
                        density="compact"
                    />
                )}
            </Paper>

            {/* Drawer: Invoice */}
            <Drawer
                anchor="right"
                open={!!viewInvoice}
                onClose={() => setViewInvoice(null)}
                PaperProps={{sx: {width: 520, p: 2}}}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6"><ReceiptLongIcon sx={{mr: 1}}/> Fatura #{viewInvoice?.id}</Typography>
                    <IconButton onClick={() => setViewInvoice(null)}><CloseIcon/></IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                    {viewInvoice && new Date(viewInvoice.createdAt).toLocaleString('pt-PT')}
                </Typography>
                <Divider sx={{my: 1.5}}/>

                {viewInvoice?.records?.length ? (
                    <Stack spacing={1}>
                        {viewInvoice.records.map((r, i) => {
                            const item = r.productItem || r.menuItem;
                            if (!item) return <Typography key={i} variant="body2" color="text.disabled">Item
                                removido</Typography>;
                            const unit = item.price || 0;
                            const disc = viewInvoice?.discountPercent || 0;
                            const unitDisc = disc > 0 ? Math.round(unit * (1 - disc / 100)) : unit;
                            return (
                                <Stack key={i} direction="row" justifyContent="space-between">
                                    <Typography variant="body2" sx={{mr: 1, flex: 1}}>
                                        {item.name}{item.isDeleted ? ' (Eliminado)' : ''}{disc ? ` — Desconto ${disc}%` : ''}
                                    </Typography>
                                    <Typography variant="body2" sx={{width: 120, textAlign: 'right'}}>
                                        {r.quantity} × {eur(unitDisc)}
                                    </Typography>
                                </Stack>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography variant="body2" color="text.disabled">Sem linhas.</Typography>
                )}

                <Divider sx={{my: 1.5}}/>
                <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1">Total</Typography>
                    <Typography variant="subtitle1" fontWeight={700}>{eur(viewInvoice?.total || 0)}</Typography>
                </Stack>

                <Stack direction="row" spacing={1} sx={{mt: 2}}>
                    {!viewInvoice?.isDeleted && (
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => setRevokeDialog(viewInvoice)}
                        >
                            Anular
                        </Button>
                    )}
                    <Button onClick={() => setViewInvoice(null)}>Fechar</Button>
                </Stack>
            </Drawer>

            {/* Drawer: Session */}
            <Drawer
                anchor="right"
                open={!!viewSession}
                onClose={() => {
                    setViewSession(null);
                    setSessionMovements(null);
                }}
                PaperProps={{sx: {width: 560, p: 2, display: 'flex', flexDirection: 'column'}}}
            >
                {!viewSession ? null : (
                    <>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6">
                                <PointOfSaleIcon sx={{mr: 1}}/>
                                Sessão #{viewSession.id}
                            </Typography>
                            <IconButton onClick={() => {
                                setViewSession(null);
                                setSessionMovements(null);
                            }}>
                                <CloseIcon/>
                            </IconButton>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                            Início: {new Date(viewSession.openedAt).toLocaleString('pt-PT')}
                            {viewSession.closedAt ? ` — Fecho: ${new Date(viewSession.closedAt).toLocaleString('pt-PT')}` : ''}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{mt: 1}}>
                            <Chip
                                size="small"
                                color={viewSession.status === 'open' ? 'success' : 'default'}
                                label={viewSession.status === 'open' ? 'Aberta' : 'Fechada'}
                            />
                        </Stack>
                        <Divider sx={{my: 1.5}}/>

                        <Box sx={{flex: 1, overflowY: 'auto', pr: 1}}>
                            {sessionDrawerLoading ? (
                                <Skeleton variant="rectangular" height={180}/>
                            ) : (
                                <>
                                    <Grid container spacing={1.5}>
                                        <Grid item xs={12} sm={6}>
                                            <KpiCard icon={<AccountBalanceWalletIcon/>} title="Abertura"
                                                     value={eur(viewSession.initialAmount || 0)}/>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <KpiCard icon={<PaymentsIcon/>} title="Vendas (Dinheiro)"
                                                     value={eur(sessionMovements?.cashSales || 0)}/>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <KpiCard
                                                icon={<AddCardIcon/>}
                                                title="Ajustes (Reforços − Sangrias)"
                                                value={eur(sessionMovements?.net || 0)}
                                                variant={sessionMovements?.net >= 0 ? 'success' : 'error'}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <KpiCard icon={<PointOfSaleIcon/>} title="Dinheiro em Caixa"
                                                     value={eur(sessionMovements?.finalCash || 0)}/>
                                        </Grid>
                                    </Grid>

                                    <Card sx={{mt: 2}}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={700}>Produtos
                                                Vendidos</Typography>
                                            <Divider sx={{my: 1}}/>
                                            {renderProductsTable()}
                                        </CardContent>
                                    </Card>

                                    <Card sx={{mt: 2}}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={700}>Pagamentos por
                                                método</Typography>
                                            <Divider sx={{my: 1}}/>
                                            <Stack spacing={0.5}>
                                                {Object.keys(sessionMovements?.byMethod || {}).length === 0 && (
                                                    <Typography variant="body2" color="text.disabled">Sem
                                                        dados.</Typography>
                                                )}
                                                {Object.entries(sessionMovements?.byMethod || {}).map(([k, v]) => (
                                                    <Stack key={k} direction="row" justifyContent="space-between">
                                                        <Typography
                                                            variant="body2">{PaymentMethods.find(p => p.id === k)?.name ?? k}</Typography>
                                                        <Typography variant="body2"
                                                                    fontWeight={600}>{eur(v)}</Typography>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        </CardContent>
                                    </Card>

                                    <Card sx={{mt: 2}}>
                                        <CardContent>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                <Typography variant="subtitle1" fontWeight={700}>Movimentos de
                                                    Caixa</Typography>
                                                <Stack direction="row" spacing={1}>
                                                    <Chip label={`Reforços: ${eur(sessionMovements?.cashIn || 0)}`}
                                                          color="success" variant="outlined" size="small"/>
                                                    <Chip label={`Sangrias: ${eur(sessionMovements?.cashOut || 0)}`}
                                                          color="error" variant="outlined" size="small"/>
                                                </Stack>
                                            </Stack>
                                            <Divider sx={{my: 1}}/>

                                            {!((sessionMovements?.list || []).length) ? (
                                                <Typography variant="body2" color="text.disabled">Sem
                                                    movimentos.</Typography>
                                            ) : (
                                                <TableContainer sx={{maxHeight: 260, overflowY: 'auto'}}>
                                                    <Table size="small" stickyHeader>
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>Tipo</TableCell>
                                                                <TableCell>Motivo</TableCell>
                                                                <TableCell align="right">Valor</TableCell>
                                                                <TableCell width={170}>Data</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {sessionMovements.list.map((m) => {
                                                                const isIn = m.type === 'CASH_IN';
                                                                return (
                                                                    <TableRow key={m.id} hover>
                                                                        <TableCell>
                                                                            <Chip
                                                                                size="small"
                                                                                label={isIn ? 'Reforço' : 'Sangria'}
                                                                                color={isIn ? 'success' : 'error'}
                                                                                variant="outlined"
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>{m.reason || '—'}</TableCell>
                                                                        <TableCell
                                                                            align="right">{eur(Number(m.amount || 0))}</TableCell>
                                                                        <TableCell>{new Date(m.createdAt).toLocaleString('pt-PT')}</TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </Box>

                        <Stack
                            direction={{xs: 'column', sm: 'row'}}
                            spacing={1}
                            justifyContent="flex-end"
                            sx={{pt: 1}}
                        >
                            {String(viewSession.status || '').toLowerCase() === 'closed' && (
                                <Button
                                    variant="contained"
                                    startIcon={<ReceiptLongIcon/>}
                                    disabled={sessionDrawerLoading || printingSession || !sessionMovements}
                                    onClick={handleReprintSession}
                                >
                                    Reimprimir resumo
                                </Button>
                            )}
                            <Button onClick={() => {
                                setViewSession(null);
                                setSessionMovements(null);
                            }}>Fechar</Button>
                        </Stack>
                    </>
                )}
            </Drawer>

            <Dialog open={!!revokeDialog} onClose={() => setRevokeDialog(null)}>
                <DialogTitle> Anular fatura #{revokeDialog?.id}? </DialogTitle>
                <DialogContent>
                    Esta ação é irreversível e não pode ser anulada.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRevokeDialog(null)}>Não</Button>
                    <Button
                        onClick={async () => {
                            try {
                                await InvoiceService.revokeInvoice(revokeDialog.id);
                                setRevokeDialog(null);
                                setViewInvoice(null);
                                fetchAll();
                            } catch (e) {
                                console.error('Falha ao anular:', e?.response?.data || e);
                            }
                        }}
                        autoFocus
                        color="error"
                        variant="contained"
                    >
                        Sim
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}

function KpiCard({icon, title, value, variant}) {
    return (
        <Card>
            <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{display: 'grid', placeItems: 'center'}}>{icon}</Box>
                    <Box sx={{flex: 1}}>
                        <Typography variant="caption" color="text.secondary">{title}</Typography>
                        <Typography variant="h6" fontWeight={700}
                                    color={variant === 'error' ? 'error.main' : variant === 'success' ? 'success.main' : 'text.primary'}>
                            {value}
                        </Typography>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default ReportsPage;
