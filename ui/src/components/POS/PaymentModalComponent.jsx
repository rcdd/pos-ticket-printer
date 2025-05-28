import React from 'react'
import Button from '@mui/material/Button';
import { Box, InputAdornment } from "@mui/material";
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';

export function PaymentModalComponent({
    openModal,
    totalAmount,
    invoiceId,
    isPrinted,
    isPrinting,
    changeValue,
    setChangeValue,
    handlePrint,
    handleModalClose }) {

    const doExchange = () => {
        const value = (changeValue - (totalAmount / 100)).toFixed(2);
        if (isNaN(value) || value < 0) {
            return '0.00€';
        }
        return value + '€';
    }

    return (
        <Dialog open={openModal} onClose={handleModalClose}
            fullWidth={true}
            maxWidth='sm'
        >
            <DialogTitle className='modal__title'>{invoiceId ? "Pagamento nº " + invoiceId : "A Pagamento"}</DialogTitle>
            <DialogContent>
                <Box
                    noValidate
                    component="form"
                    sx={{
                        display: 'flex', flexDirection: 'column', m: 'auto', width: 'fit-content',
                    }}
                >
                    <span className='modal__total'>Total: <b>{(totalAmount / 100).toFixed(2)}€</b></span>
                    <div className='modal__receive-value'>
                        <span>Valor recebido:</span>
                        <TextField
                            autoFocus
                            margin="dense"
                            type="amount"
                            variant="filled"
                            label={'Insira o valor recebido'}
                            fullWidth
                            defaultValue={(totalAmount / 100).toFixed(2)}
                            className={'modal__receive-value__input'}
                            onFocus={event => {
                                event.target.select();
                            }}
                            InputProps={{
                                endAdornment: <InputAdornment position="start">€</InputAdornment>,
                            }}
                            onChange={(value) => setChangeValue(value.target.value.replace(",", "."))}
                            onKeyUp={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    !isPrinted ? handlePrint(true) : handleModalClose();
                                }
                            }}
                        />
                    </div>
                    <span className='modal__exchange'>Troco: <b>{doExchange()}</b></span>
                </Box>
            </DialogContent>

            <DialogActions>
                {!isPrinted && <LoadingButton loading={isPrinting} loadingIndicator="A imprimir.."
                    variant="contained" fullWidth={true} size="large"
                    onClick={() => handlePrint(true)}>
                    Imprimir
                </LoadingButton>}

                {isPrinted && <Button variant="contained" fullWidth={true} size="large"
                    onClick={handleModalClose}>Fechar</Button>}
            </DialogActions>
        </Dialog>
    )
}