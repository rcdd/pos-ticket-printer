import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import OrderService from '../../services/order.service';
import {useToast} from '../Common/ToastProvider';

const eur = new Intl.NumberFormat('pt-PT', {style: 'currency', currency: 'EUR'});

const newRequestId = () =>
    (window.crypto?.randomUUID ? window.crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Sends the POS cart as a table/standalone order (no payment).
// Each submit is a new order — prints a ticket and accrues on the tab;
// closing/paying still happens on the Pedidos page.
export default function SendToTableDialog({open, cart, totalAmount, onClose, onSent}) {
    const {pushNetworkError} = useToast();
    const [tables, setTables] = useState(null);
    const [selected, setSelected] = useState(null); // {kind:'table', id, number} | {kind:'new'} | {kind:'standalone'}
    const [newNumber, setNewNumber] = useState('');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        try {
            const {data} = await OrderService.getTables('open');
            setTables(data);
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível carregar as mesas'});
            setTables([]);
        }
    }, [pushNetworkError]);

    useEffect(() => {
        if (!open) return;
        setSelected(null);
        setNewNumber('');
        setNote('');
        setTables(null);
        load();
    }, [open, load]);

    const items = useMemo(() => (cart ?? []).map((item) => ({
        productId: item.type === 'Menu' ? undefined : item.id,
        menuId: item.type === 'Menu' ? item.id : undefined,
        quantity: item.quantity,
    })), [cart]);

    const send = async () => {
        if (!selected || sending) return;
        setSending(true);
        try {
            let tableId = null;
            let tableNumber = null;

            if (selected.kind === 'table') {
                tableId = selected.id;
                tableNumber = selected.number;
            } else if (selected.kind === 'new') {
                const {data: table} = await OrderService.openTable(newNumber.trim() || undefined);
                tableId = table.id;
                tableNumber = table.displayName || table.number;
            }

            const {data} = await OrderService.create({
                tableId,
                note: note.trim() || undefined,
                clientRequestId: newRequestId(),
                items,
            });

            onSent({...data, tableNumber});
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível enviar o pedido'});
        } finally {
            setSending(false);
        }
    };

    const canSend = Boolean(selected) && items.length > 0
        && (selected?.kind !== 'new' || true); // empty number = auto-assign

    return (
        <Dialog open={open} onClose={sending ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                <span>Enviar pedido (sem pagar)</span>
                <Typography variant="h6" component="span" color="text.secondary">
                    {eur.format((totalAmount || 0) / 100)}
                </Typography>
            </DialogTitle>

            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
                    O pedido é impresso para a cozinha e acumula na conta — o pagamento faz-se depois,
                    na página Pedidos.
                </Typography>

                <Typography variant="subtitle2" gutterBottom>Destino</Typography>

                {tables === null ? (
                    <CircularProgress size={22}/>
                ) : (
                    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{mb: 1.5}}>
                        {tables.map((table) => (
                            <Chip
                                key={table.id}
                                icon={<TableRestaurantIcon/>}
                                label={`Mesa ${table.displayName || table.number}${table.openOrders ? ` · ${eur.format(table.unpaidTotal / 100)}` : ''}`}
                                color={selected?.kind === 'table' && selected.id === table.id ? 'primary' : 'default'}
                                onClick={() => setSelected({kind: 'table', id: table.id, number: table.displayName || table.number})}
                                sx={{py: 2.2, fontSize: 15}}
                            />
                        ))}
                        <Chip
                            icon={<TableRestaurantIcon/>}
                            label="Novo grupo"
                            variant={selected?.kind === 'new' ? 'filled' : 'outlined'}
                            color={selected?.kind === 'new' ? 'primary' : 'default'}
                            onClick={() => setSelected({kind: 'new'})}
                            sx={{py: 2.2, fontSize: 15}}
                        />
                        <Chip
                            icon={<ReceiptLongIcon/>}
                            label="Pedido avulso"
                            variant={selected?.kind === 'standalone' ? 'filled' : 'outlined'}
                            color={selected?.kind === 'standalone' ? 'primary' : 'default'}
                            onClick={() => setSelected({kind: 'standalone'})}
                            sx={{py: 2.2, fontSize: 15}}
                        />
                    </Stack>
                )}

                {selected?.kind === 'new' && (
                    <TextField
                        label="Nº da mesa (novo grupo; vazio = automático)"
                        size="small"
                        value={newNumber}
                        inputProps={{inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4}}
                        onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        sx={{mb: 1.5, width: {xs: '100%', sm: 260}}}
                    />
                )}

                <Box>
                    <TextField
                        label="Observações (ex.: sem gelo)"
                        size="small"
                        fullWidth
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={sending}>Cancelar</Button>
                <LoadingButton
                    variant="contained"
                    loading={sending}
                    disabled={!canSend}
                    onClick={send}
                >
                    Enviar pedido
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
