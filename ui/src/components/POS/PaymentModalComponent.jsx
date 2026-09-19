import React, {useEffect, useMemo, useState} from 'react';
import {
    Box, Checkbox, FormControlLabel, InputAdornment, Dialog,
    DialogActions, DialogContent, DialogTitle, Button,
    Divider, Stack, Typography
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import NumericTextFieldWithKeypad from '../Common/NumericTextFieldKeypad';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {PaymentMethods} from "../../enums/PaymentMethodsEnum";
import GroupsIcon from '@mui/icons-material/Groups';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {IconButton, MenuItem, Select} from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';

export function PaymentModalComponent({
                                          openModal,
                                          totalAmount,
                                          invoiceId,
                                          isPrinted,
                                          isPrinting,
                                          handlePrint,
                                          handleModalClose,
                                      }) {
    const [discount, setDiscount] = useState(false);
    const [discountPctStr, setDiscountPctStr] = useState('100');
    const [receivedStr, setReceivedStr] = useState('');
    const [paymentMethod, setPaymentMethod] = useState("cash");

    // split bill: N people, one parcel each (amount editable, method per
    // parcel); the parcels must sum to the discounted total
    const [splitMode, setSplitMode] = useState(false);
    const [splitN, setSplitN] = useState(2);
    const [parcels, setParcels] = useState([]);

    const toNumber = (s) => {
        if (s == null) return NaN;
        const n = String(s).replace(',', '.');
        return n === '' ? NaN : Number(n);
    };
    const eurFmt = useMemo(() => new Intl.NumberFormat('pt-PT', {style: 'currency', currency: 'EUR'}), []);

    const originalDue = useMemo(() => (totalAmount ?? 0) / 100, [totalAmount]);

    const pct = useMemo(() => {
        const p = Math.max(0, Math.min(100, Math.floor(toNumber(discountPctStr) || 0)));
        return discount ? p : 0;
    }, [discount, discountPctStr]);

    const discountedDue = useMemo(() => {
        const euros = originalDue * (1 - pct / 100);
        return Math.round(euros * 100) / 100;
    }, [originalDue, pct]);

    const received = useMemo(() => {
        const n = toNumber(receivedStr);
        return Number.isFinite(n) ? n : 0;
    }, [receivedStr]);

    // split: generate N equal parcels (first ones absorb the rounding cents)
    const makeParcels = (totalCents, n) => {
        const base = Math.floor(totalCents / n);
        const extra = totalCents - base * n;
        return Array.from({length: n}, (_, i) => ({
            amountStr: ((base + (i < extra ? 1 : 0)) / 100).toFixed(2).replace('.', ','),
            method: 'cash',
        }));
    };

    useEffect(() => {
        if (!splitMode) return;
        setParcels(makeParcels(Math.round(discountedDue * 100), splitN));
    }, [splitMode, splitN, discountedDue]);

    const parcelCents = useMemo(
        () => parcels.map((p) => Math.round((toNumber(p.amountStr) || 0) * 100)),
        [parcels],
    );
    const parcelsSum = useMemo(() => parcelCents.reduce((a, b) => a + b, 0), [parcelCents]);
    const parcelsDiff = useMemo(
        () => Math.round(discountedDue * 100) - parcelsSum,
        [discountedDue, parcelsSum],
    );
    const cashDue = useMemo(
        () => parcels.reduce((acc, p, i) => acc + (p.method === 'cash' ? parcelCents[i] : 0), 0) / 100,
        [parcels, parcelCents],
    );

    // the "received" input follows the cash portion automatically: editing a
    // parcel (amount or method) resets it to exactly what is due in cash
    useEffect(() => {
        if (!splitMode) return;
        setReceivedStr(cashDue.toFixed(2).replace('.', ','));
    }, [splitMode, cashDue]);

    const updateParcel = (index, patch) => {
        setParcels((prev) => prev.map((p, i) => (i === index ? {...p, ...patch} : p)));
    };
    const fixLastParcel = () => {
        setParcels((prev) => {
            if (prev.length === 0) return prev;
            const others = parcelCents.slice(0, -1).reduce((a, b) => a + b, 0);
            const last = Math.max(0, Math.round(discountedDue * 100) - others);
            return prev.map((p, i) => i === prev.length - 1
                ? {...p, amountStr: (last / 100).toFixed(2).replace('.', ',')}
                : p);
        });
    };

    const effectiveReceived = useMemo(() => {
        if (splitMode) return cashDue > 0 ? received : 0;
        return paymentMethod === "cash" ? received : discountedDue;
    }, [splitMode, cashDue, paymentMethod, received, discountedDue]);

    const handleDiscount = (v) => {
        setDiscount(v);
        setReceivedStr("0,00");
    }

    const change = useMemo(() => {
        const due = splitMode ? cashDue : discountedDue;
        return Math.max(0, effectiveReceived - due);
    }, [splitMode, cashDue, effectiveReceived, discountedDue]);

    useEffect(() => {
        if (!openModal) return;
        setDiscount(false);
        setDiscountPctStr('100');
        setReceivedStr(originalDue.toFixed(2).replace('.', ','));
        setPaymentMethod("cash");
        setSplitMode(false);
        setSplitN(2);
        setParcels([]);
    }, [openModal, originalDue]);

    const canPrint = splitMode
        ? (parcelsDiff === 0 && discountedDue > 0 && (cashDue === 0 || effectiveReceived >= cashDue))
        : (effectiveReceived >= discountedDue && discountedDue >= 0);

    const sendToPrint = () => {
        const discountedCents = Math.round(discountedDue * 100);
        if (splitMode) {
            const payments = parcels.map((p, i) => ({method: p.method, amount: parcelCents[i]}));
            const anyCash = payments.some((p) => p.method === 'cash' && p.amount > 0);
            const primary = [...payments].sort((a, b) => b.amount - a.amount)[0]?.method ?? 'cash';
            handlePrint(true, discountedCents, pct, primary, anyCash, payments);
            return;
        }
        handlePrint(true, discountedCents, pct, paymentMethod, paymentMethod === 'cash', null);
    };

    const setExact = () =>
        setReceivedStr((splitMode ? cashDue : discountedDue).toFixed(2).replace('.', ','));
    const bump = (inc) => {
        const current = toNumber(receivedStr) || 0;
        const nextNum = Math.min(current + inc, 999999.99);
        setReceivedStr(nextNum.toFixed(2).replace('.', ','));
    };
    const setNote = (note) => setReceivedStr(note.toFixed(2).replace('.', ','));

    const pctError = discount && (toNumber(discountPctStr) < 0 || toNumber(discountPctStr) > 100);

    return (
        <Dialog open={openModal} onClose={handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                <span>{isPrinted ? `Pagamento concluído${invoiceId ? ` — fatura nº ${invoiceId}` : ''}` : 'Pagamento'}</span>
                <Typography variant="h5" component="span" color="text.secondary">
                    Total: <b>{eurFmt.format(discountedDue)}</b>
                </Typography>
            </DialogTitle>

            <DialogContent>
                {isPrinted ? (
                    <Stack spacing={2} alignItems="center" sx={{py: 2}}>
                        <CheckCircleIcon color="success" sx={{fontSize: 56}}/>
                        <Typography variant="h6">Pagamento registado</Typography>

                        <Box sx={{
                            width: '100%',
                            p: 2,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            rowGap: 0.75,
                            columnGap: 2,
                        }}>
                            <Typography variant="body1">Total pago</Typography>
                            <Typography variant="body1" textAlign="right" fontWeight={700}>
                                {eurFmt.format(discountedDue)}
                            </Typography>
                            {pct > 0 && (
                                <>
                                    <Typography variant="body2" color="text.secondary">Desconto aplicado</Typography>
                                    <Typography variant="body2" textAlign="right">{pct}%</Typography>
                                </>
                            )}
                            {splitMode ? parcels.map((parcel, index) => (
                                <React.Fragment key={index}>
                                    <Typography variant="body2" color="text.secondary">
                                        Pessoa {index + 1} — {PaymentMethods.find((m) => m.id === parcel.method)?.name ?? parcel.method}
                                    </Typography>
                                    <Typography variant="body2" textAlign="right">
                                        {parcel.amountStr} €
                                    </Typography>
                                </React.Fragment>
                            )) : (
                                <>
                                    <Typography variant="body2" color="text.secondary">Método</Typography>
                                    <Typography variant="body2" textAlign="right">
                                        {PaymentMethods.find((m) => m.id === paymentMethod)?.name ?? paymentMethod}
                                    </Typography>
                                </>
                            )}
                            {(splitMode ? cashDue > 0 : paymentMethod === 'cash') && (
                                <>
                                    <Typography variant="body2" color="text.secondary">Dinheiro recebido</Typography>
                                    <Typography variant="body2" textAlign="right">{eurFmt.format(effectiveReceived)}</Typography>
                                </>
                            )}
                        </Box>

                        {change > 0 && (
                            <Box sx={{textAlign: 'center'}}>
                                <Typography variant="subtitle1" color="text.secondary">Troco</Typography>
                                <Typography variant="h3" fontWeight={800} color="primary.main">
                                    {eurFmt.format(change)}
                                </Typography>
                            </Box>
                        )}
                    </Stack>
                ) : (
                <Stack spacing={2}>
                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            rowGap: 0.5,
                            columnGap: 2,
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">Total original</Typography>
                        <Typography variant="body2" textAlign="right">{eurFmt.format(originalDue)}</Typography>

                        <Typography variant="body2" color="text.secondary">Desconto</Typography>
                        <Typography variant="body2" textAlign="right">
                            {discount ? `${pct}% (${eurFmt.format(originalDue - discountedDue)})` : '—'}
                        </Typography>

                        <Divider sx={{gridColumn: '1 / -1', my: 0.5}}/>

                        <Typography variant="subtitle1">A pagar</Typography>
                        <Typography variant="subtitle1" textAlign="right" fontWeight={700}>
                            {eurFmt.format(discountedDue)}
                        </Typography>
                    </Box>

                    <Stack direction="row" alignItems="baseline" className="mt-0">
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="medium"
                                    checked={discount}
                                    onChange={(e) => handleDiscount(e.target.checked)}
                                    inputProps={{'aria-label': 'Aplicar desconto'}}
                                />
                            }
                            label="Aplicar desconto"
                        />

                        {discount && (
                            <NumericTextFieldWithKeypad
                                value={discountPctStr}
                                onChange={(v) => {
                                    const n = Math.max(0, Math.min(100, parseInt(String(v).replace(/\D/g, ''), 10) || 0));
                                    setDiscountPctStr(String(n));
                                }}
                                maxLength={3}
                                textFieldProps={{
                                    label: 'Desconto (%)',
                                    fullWidth: false,
                                    error: pctError,
                                    helperText: pctError ? 'Introduza um valor entre 0 e 100' : ' ',
                                    InputProps: {
                                        size: "small",
                                        sx: {fontSize: 14},
                                        endAdornment: <InputAdornment position="end">%</InputAdornment>
                                    },
                                    sx: {mt: 1},
                                }}
                            />
                        )}
                    </Stack>

                    <Box sx={{mt: 0}}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle2" gutterBottom>
                                {splitMode ? 'Conta dividida' : 'Método de pagamento'}
                            </Typography>
                            <Button
                                size="small"
                                variant={splitMode ? 'contained' : 'outlined'}
                                startIcon={<GroupsIcon/>}
                                onClick={() => setSplitMode((v) => !v)}
                            >
                                {splitMode ? 'Pagamento único' : 'Dividir conta'}
                            </Button>
                        </Stack>
                        {!splitMode && (
                            <ToggleButtonGroup
                                value={paymentMethod}
                                exclusive
                                onChange={(_, v) => v && setPaymentMethod(v)}
                                fullWidth
                                size="small"
                                color="primary"
                            >
                                {PaymentMethods.map((type) => (
                                    <ToggleButton key={type.id} value={type.id}>{type.name}</ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        )}
                    </Box>

                    {splitMode && (
                        <>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2">Dividir por</Typography>
                                <IconButton size="small" disabled={splitN <= 2}
                                            onClick={() => setSplitN((n) => Math.max(2, n - 1))}>
                                    <RemoveIcon fontSize="small"/>
                                </IconButton>
                                <Typography variant="h6" fontWeight={700} sx={{width: 32, textAlign: 'center'}}>
                                    {splitN}
                                </Typography>
                                <IconButton size="small" disabled={splitN >= 12}
                                            onClick={() => setSplitN((n) => Math.min(12, n + 1))}>
                                    <AddIcon fontSize="small"/>
                                </IconButton>
                                <Typography variant="body2">pessoas</Typography>
                                <Box sx={{flex: 1}}/>
                                <Typography variant="body2" color="text.secondary">
                                    {eurFmt.format(discountedDue / splitN)} /pessoa
                                </Typography>
                            </Stack>

                            <Stack spacing={1}>
                                {parcels.map((parcel, index) => (
                                    <Stack key={index} direction="row" spacing={1} alignItems="center">
                                        <Typography variant="body2" sx={{width: 66}} color="text.secondary">
                                            Pessoa {index + 1}
                                        </Typography>
                                        <NumericTextFieldWithKeypad
                                            value={parcel.amountStr}
                                            onChange={(v) => updateParcel(index, {amountStr: v})}
                                            decimal
                                            maxLength={9}
                                            textFieldProps={{
                                                size: 'small',
                                                sx: {flex: 1},
                                                InputProps: {
                                                    size: 'small',
                                                    endAdornment: <InputAdornment position="end">€</InputAdornment>,
                                                },
                                            }}
                                        />
                                        <Select
                                            size="small"
                                            value={parcel.method}
                                            MenuProps={{disableScrollLock: true}}
                                            onChange={(e) => updateParcel(index, {method: e.target.value})}
                                            sx={{minWidth: 130}}
                                        >
                                            {PaymentMethods.map((type) => (
                                                <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </Stack>
                                ))}
                            </Stack>

                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    variant="body2"
                                    fontWeight={700}
                                    color={parcelsDiff === 0 ? 'success.main' : 'error.main'}
                                >
                                    {parcelsDiff === 0
                                        ? 'As parcelas fecham a conta ✓'
                                        : parcelsDiff > 0
                                            ? `Falta ${eurFmt.format(parcelsDiff / 100)}`
                                            : `Excesso de ${eurFmt.format(-parcelsDiff / 100)}`}
                                </Typography>
                                <Box sx={{flex: 1}}/>
                                {parcelsDiff !== 0 && (
                                    <Button size="small" variant="outlined" onClick={fixLastParcel}>
                                        Acertar última
                                    </Button>
                                )}
                            </Stack>
                        </>
                    )}

                    {(splitMode ? cashDue > 0 : paymentMethod === "cash") && (
                        <>
                            <Typography variant="subtitle2">
                                {splitMode ? `Dinheiro a receber: ${eurFmt.format(cashDue)}` : 'Valor recebido'}
                            </Typography>
                            <Stack direction="row" className="mt-0">
                                <NumericTextFieldWithKeypad
                                    value={receivedStr}
                                    onChange={setReceivedStr}
                                    decimal
                                    maxLength={9}
                                    textFieldProps={{
                                        fullWidth: true,
                                        placeholder: '0,00',
                                        error: effectiveReceived < (splitMode ? cashDue : discountedDue),
                                        helperText: effectiveReceived < (splitMode ? cashDue : discountedDue) ? 'Valor recebido insuficiente' : ' ',
                                        InputProps: {
                                            size: "small",
                                            endAdornment: <InputAdornment position="end">€</InputAdornment>
                                        },
                                    }}
                                />
                            </Stack>

                            <Box sx={{mt: "0!important", mb: "8px!important"}}>
                                <Button variant="contained" fullWidth color="success" onClick={setExact}
                                        sx={{py: 0.5, fontSize: 16}}>
                                    Valor Exacto
                                </Button>
                                <Box
                                    sx={{
                                        mt: 1.2,
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(6, 1fr)',
                                        gap: 1.2,
                                    }}
                                >
                                    <Button variant="contained" onClick={() => setNote(0)}
                                            sx={{py: 0.5, fontSize: 16}}>€0</Button>
                                    <Button variant="contained" onClick={() => setNote(1)}
                                            sx={{py: 0.5, fontSize: 16}}>€1</Button>
                                    <Button variant="contained" onClick={() => setNote(5)}
                                            sx={{py: 0.5, fontSize: 16}}>€5</Button>
                                    <Button variant="contained" onClick={() => setNote(10)}
                                            sx={{py: 0.5, fontSize: 16}}>€10</Button>
                                    <Button variant="contained" onClick={() => setNote(20)}
                                            sx={{py: 0.5, fontSize: 16}}>€20</Button>
                                    <Button variant="contained" onClick={() => setNote(50)}
                                            sx={{py: 0.5, fontSize: 16}}>€50</Button>

                                    <Button variant="outlined" onClick={() => bump(0.05)}
                                            sx={{py: 0.5, fontSize: 16}}>+0,05</Button>
                                    <Button variant="outlined" onClick={() => bump(0.10)}
                                            sx={{py: 0.5, fontSize: 16}}>+0,10</Button>
                                    <Button variant="outlined" onClick={() => bump(0.50)}
                                            sx={{py: 0.5, fontSize: 16}}>+0,50</Button>
                                    <Button variant="outlined" onClick={() => bump(1)}
                                            sx={{py: 0.5, fontSize: 16}}>+1</Button>
                                    <Button variant="outlined" onClick={() => bump(2)}
                                            sx={{py: 0.5, fontSize: 16}}>+2</Button>
                                    <Button variant="outlined" onClick={() => bump(5)}
                                            sx={{py: 0.5, fontSize: 16}}>+5</Button>
                                </Box>
                            </Box>

                            <Box sx={{display: 'flex', justifyContent: 'space-between', mt: "16px!important"}}>
                                <Typography variant="h6">Troco</Typography>
                                <Typography variant="h5" fontWeight={700}>
                                    {eurFmt.format(change)}
                                </Typography>
                            </Box>
                        </>
                    )}
                </Stack>
                )}
            </DialogContent>

            <DialogActions sx={{gap: 1}}>
                {!isPrinted ? (
                    <LoadingButton
                        loading={isPrinting}
                        loadingIndicator="A imprimir…"
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={sendToPrint}
                        disabled={!canPrint}
                    >
                        Imprimir
                    </LoadingButton>
                ) : (
                    <Button variant="contained" fullWidth size="large" onClick={handleModalClose}>
                        Fechar
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}