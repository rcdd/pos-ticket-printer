import React from 'react';
import {
    Box, Paper, Stack, Typography, Button, Chip, Divider, IconButton,
    Toolbar, TextField, MenuItem, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Drawer
} from '@mui/material';
import {DataGrid} from '@mui/x-data-grid';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import InvoiceService from '../../services/invoice.service';
import SessionService from '../../services/session.service';
import {PaymentMethods} from '../../enums/PaymentMethodsEnum';

function ReportsPage() {
    // data
    const [sessions, setSessions] = React.useState([]);
    const [invoices, setInvoices] = React.useState([]);

    // ui
    const [loading, setLoading] = React.useState(true);
    const [tab, setTab] = React.useState('invoices'); // 'sessions' | 'invoices' | 'products'
    const [viewInvoice, setViewInvoice] = React.useState(null);
    const [revokeDialog, setRevokeDialog] = React.useState(null);

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
        () => (cents) => (cents / 100).toLocaleString('pt-PT', {minimumFractionDigits: 2}) + ' €',
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
                    zone: item.zone?.name || '—' + (item.zone?.isDeleted ? ' (Eliminado)' : ''),
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
            acc.total += inv.total || 0;
            if (inv.paymentMethod === 'cash') acc.cash += inv.total || 0;
            if (inv.paymentMethod === 'card') acc.card += inv.total || 0;
            if (inv.paymentMethod === 'mbway') acc.mbway += inv.total || 0;
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
                <Chip size="small" color={p.value === 'open' ? 'success' : 'default'}
                      label={p.value === 'open' ? 'Aberta' : 'Fechada'}/>
            )
        },
        {field: 'initialAmount', headerName: 'Abertura', width: 120, valueFormatter: (v) => eur(v)},
        {field: 'invoices', headerName: 'Faturas', width: 110},
        {field: 'revoked', headerName: 'Anuladas', width: 110},
        {field: 'total', headerName: 'Total', width: 140, valueFormatter: (v) => eur(v)},
        {field: 'cash', headerName: 'Dinheiro', width: 120, valueFormatter: (v) => eur(v)},
        {field: 'card', headerName: 'Multibanco', width: 130, valueFormatter: (v) => eur(v)},
        {field: 'mbway', headerName: 'MB Way', width: 120, valueFormatter: (v) => eur(v)},
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
                                sortModel: [{ field: 'openedAt', sort: 'desc' }],
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
                                sortModel: [{ field: 'createdAt', sort: 'desc' }],
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
                                    <Typography variant="body2" sx={{width: 90, textAlign: 'right'}}>
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

export default ReportsPage;
