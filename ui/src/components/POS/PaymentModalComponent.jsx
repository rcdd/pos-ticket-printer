import React, {useEffect, useMemo, useState} from 'react';
import {
    Box, Checkbox, FormControlLabel, InputAdornment, Dialog,
    DialogActions, DialogContent, DialogTitle, TextField, Button
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';

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
    const [discountPercentage, setDiscountPercentage] = useState(100);
    const [receivedEuros, setReceivedEuros] = useState(totalAmount / 100);

    const discountedTotal = useMemo(() => {
        if (!discount) return totalAmount;
        const pct = Math.min(100, Math.max(0, discountPercentage));
        const discountedValue = Math.round(totalAmount * (1 - pct / 100));
        setReceivedEuros(discountedValue / 100);

        return discountedValue;
    }, [totalAmount, discount, discountPercentage]);

    const changeEuros = useMemo(() => {
        const due = discountedTotal / 100;
        const change = receivedEuros - due;
        return change > 0 ? change : 0;
    }, [receivedEuros, discountedTotal]);

    useEffect(() => {
        if (openModal) {
            setDiscount(false);
            setDiscountPercentage(100);
            setReceivedEuros(totalAmount / 100);
        }
    }, [openModal, totalAmount]);

    const sendToPrint = () => {
        handlePrint(true, discountedTotal);
    };

    const formatEUR = (n) => `${n.toFixed(2)}€`;

    return (
        <Dialog open={openModal} onClose={handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle className="modal__title">
                {invoiceId ? `Pagamento nº ${invoiceId}` : 'A Pagamento'}
            </DialogTitle>

            <DialogContent>
                <Box
                    component="form"
                    noValidate
                    sx={{display: 'flex', flexDirection: 'column', m: 'auto', width: 'fit-content'}}
                >
          <span className="modal__total">
            Total: <b>{formatEUR(discountedTotal / 100)}</b>
          </span>

                    <FormControlLabel
                        control={
                            <Checkbox
                                size="large"
                                checked={discount}
                                onChange={(e) => setDiscount(e.target.checked)}
                                inputProps={{'aria-label': 'Aplicar Desconto'}}
                            />
                        }
                        label="Aplicar Desconto"
                        componentsProps={{typography: {fontSize: '1.4rem'}}}
                    />

                    {discount && (
                        <TextField
                            margin="dense"
                            variant="filled"
                            label="Insira o valor do desconto (%)"
                            fullWidth
                            type="number"
                            inputProps={{min: 0, max: 100, step: 1}}
                            value={discountPercentage}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (Number.isNaN(v)) return;
                                setDiscountPercentage(Math.max(0, Math.min(100, v)));
                            }}
                            onKeyUp={(e) => {
                                if (e.key === 'Enter') (!isPrinted ? sendToPrint() : handleModalClose());
                            }}
                            InputProps={{endAdornment: <InputAdornment position="end">%</InputAdornment>}}
                            className="modal__percentage-value__input"
                        />
                    )}

                    <div className="modal__receive-value">
                        <span>Valor recebido:</span>
                        <TextField
                            margin="dense"
                            variant="filled"
                            label="Insira o valor recebido"
                            fullWidth
                            type="number"
                            inputMode="decimal"
                            value={Number.isFinite(receivedEuros) ? receivedEuros : ''}
                            onChange={(e) => {
                                const v = parseFloat(String(e.target.value).replace(',', '.'));
                                if (Number.isNaN(v)) return setReceivedEuros(0);
                                setReceivedEuros(v);
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyUp={(e) => {
                                if (e.key === 'Enter') (!isPrinted ? sendToPrint() : handleModalClose());
                            }}
                            InputProps={{endAdornment: <InputAdornment position="end">€</InputAdornment>}}
                            className="modal__receive-value__input"
                        />
                    </div>

                    <span className="modal__exchange">
            Troco: <b>{formatEUR(changeEuros)}</b>
          </span>
                </Box>
            </DialogContent>

            <DialogActions>
                {!isPrinted ? (
                    <LoadingButton
                        loading={isPrinting}
                        loadingIndicator="A imprimir.."
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={sendToPrint}
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
