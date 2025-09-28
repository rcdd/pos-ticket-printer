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

    const effectiveReceived = useMemo(() => {
        return paymentMethod === "cash" ? received : discountedDue;
    }, [paymentMethod, received, discountedDue]);

    const handleDiscount = (v) => {
        setDiscount(v);
        setReceivedStr("0,00");
    }

    const change = useMemo(() => Math.max(0, effectiveReceived - discountedDue), [effectiveReceived, discountedDue]);

    useEffect(() => {
        if (!openModal) return;
        setDiscount(false);
        setDiscountPctStr('100');
        setReceivedStr(originalDue.toFixed(2).replace('.', ','));
        setPaymentMethod("cash");
    }, [openModal, originalDue]);

    const canPrint = effectiveReceived >= discountedDue && discountedDue >= 0;

    const sendToPrint = () => {
        const discountedCents = Math.round(discountedDue * 100);
        handlePrint(true, discountedCents, pct, paymentMethod);
    };

    const setExact = () =>
        setReceivedStr(discountedDue.toFixed(2).replace('.', ','));
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
                <span>{invoiceId ? `Pagamento nº ${invoiceId}` : 'Pagamento'}</span>
                <Typography variant="h6" component="span" color="text.secondary">
                    Total: <b>{eurFmt.format(discountedDue)}</b>
                </Typography>
            </DialogTitle>

            <DialogContent>
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
                        <Typography variant="subtitle2" gutterBottom>Método de pagamento</Typography>
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
                    </Box>

                    {paymentMethod === "cash" && (
                        <>
                            <Typography variant="subtitle2">Valor recebido</Typography>
                            <Stack direction="row" className="mt-0">
                                <NumericTextFieldWithKeypad
                                    value={receivedStr}
                                    onChange={setReceivedStr}
                                    decimal
                                    maxLength={9}
                                    textFieldProps={{
                                        fullWidth: true,
                                        placeholder: '0,00',
                                        error: effectiveReceived < discountedDue,
                                        helperText: effectiveReceived < discountedDue ? 'Valor recebido insuficiente' : ' ',
                                        InputProps: {
                                            size: "small",
                                            endAdornment: <InputAdornment position="end">€</InputAdornment>
                                        },
                                    }}
                                />
                            </Stack>

                            <Box sx={{mt: "0!important", mb: "8px!important"}}>
                                <Button variant="contained" fullWidth color="success" onClick={setExact}
                                        sx={{py: 0.5, fontSize: 14}}>
                                    Valor Exacto
                                </Button>
                                <Box
                                    sx={{
                                        mt: 1.2,
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(5, 1fr)',
                                        gap: 1.2,
                                    }}
                                >
                                    <Button variant="outlined" onClick={() => bump(0.10)}
                                            sx={{py: 0.5, fontSize: 14}}>+0,10</Button>
                                    <Button variant="outlined" onClick={() => bump(0.50)}
                                            sx={{py: 0.5, fontSize: 14}}>+0,50</Button>
                                    <Button variant="outlined" onClick={() => bump(1)}
                                            sx={{py: 0.5, fontSize: 14}}>+1</Button>
                                    <Button variant="outlined" onClick={() => bump(2)}
                                            sx={{py: 0.5, fontSize: 14}}>+2</Button>
                                    <Button variant="outlined" onClick={() => bump(5)}
                                            sx={{py: 0.5, fontSize: 14}}>+5</Button>
                                    <Button variant="contained" onClick={() => setNote(5)}
                                            sx={{py: 0.5, fontSize: 14}}>€5</Button>
                                    <Button variant="contained" onClick={() => setNote(10)}
                                            sx={{py: 0.5, fontSize: 14}}>€10</Button>
                                    <Button variant="contained" onClick={() => setNote(20)}
                                            sx={{py: 0.5, fontSize: 14}}>€20</Button>
                                    <Button variant="contained" onClick={() => setNote(50)}
                                            sx={{py: 0.5, fontSize: 14}}>€50</Button>
                                    <Button variant="contained" onClick={() => setNote(100)}
                                            sx={{py: 0.5, fontSize: 14}}>€100</Button>
                                </Box>
                            </Box>

                            <Box sx={{display: 'flex', justifyContent: 'space-between', mt: "16px!important"}}>
                                <Typography variant="h6">Troco</Typography>
                                <Typography variant="h6" fontWeight={700}>
                                    {eurFmt.format(change)}
                                </Typography>
                            </Box>
                        </>
                    )}
                </Stack>
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