import React, {useEffect, useMemo, useState} from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, IconButton, Button, Divider, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TextFieldKeyboard from "../Common/TextFieldKeyboard";
import CashMovementService from "../../services/cashMovement.service";
import NumericTextFieldWithKeypad from "../Common/NumericTextFieldKeypad";
import {useToast} from "../Common/ToastProvider";

export default function CashMovementModal({open, onClose, modalType, session, onSaved}) {
    const {pushNetworkError} = useToast();
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setAmount("");
            setReason("");
            setSubmitting(false);
        }
    }, [open]);

    const parsedValue = useMemo(() => {
        const v = (amount ?? "").toString().replace(",", ".");
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
    }, [amount]);

    const amountInvalid = !session?.id || !Number.isFinite(parsedValue) || parsedValue <= 0;

    const handleSubmit = async () => {
        if (amountInvalid || submitting || !session?.id) return;
        try {
            setSubmitting(true);

            if (modalType === "CASH_OUT" && parsedValue >= 1000) {
                const ok = window.confirm("Valor de sangria elevado. Confirmar operação?");
                if (!ok) {
                    setSubmitting(false);
                    return;
                }
            }

            const userRaw = localStorage.getItem("user");
            const user = userRaw ? JSON.parse(userRaw) : null;

            const payload = {
                sessionId: session.id,
                type: modalType,
                amount: parsedValue * 100,
                reason: reason?.trim() || null,
                userId: user?.id,
            };

            await CashMovementService.create(payload);
            if (onSaved) onSaved();
            onClose(true);
        } catch (e) {
            console.error(e);
            pushNetworkError(e, {title: "Não foi possível registar o movimento de caixa"});
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="xs">
            <DialogTitle sx={{pr: 6}}>
                {modalType === "CASH_IN" ? "Reforço" : "Sangria"}
            </DialogTitle>

            <IconButton
                aria-label="Fechar"
                onClick={() => onClose(false)}
                sx={(theme) => ({
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon/>
            </IconButton>

            <DialogContent>
                <Box
                    component="form"
                    noValidate
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        width: "100%",
                        maxWidth: 420,
                        m: "0 auto",
                    }}
                >
                    <NumericTextFieldWithKeypad
                        value={amount}
                        onChange={(val) => setAmount(String(val ?? ""))}
                        decimal
                        inputMode="decimal"
                        textFieldProps={{
                            label: "Montante",
                            fullWidth: true,
                            autoFocus: true,
                            autoComplete: "off",
                            error: amount.length > 0 && amountInvalid,
                            helperText: amount.length > 0 && amountInvalid ? "Introduza um valor superior a 0" : " ",
                            InputProps: {
                                inputProps: {min: 0},
                                endAdornment: <Box sx={{mr: 1}}>€</Box>,
                            },
                        }}
                        maxLength={10}
                        showSymbols={false}
                    />

                    <TextFieldKeyboard
                        value={reason}
                        onChange={setReason}
                        textFieldProps={{
                            label: "Motivo (opcional)",
                            fullWidth: true,
                            autoComplete: "off",
                        }}
                        maxLength={64}
                        showSymbols={false}
                    />

                    <Divider/>
                    <Typography variant="body2" color="text.secondary">
                        {modalType === "CASH_IN"
                            ? "Regista uma entrada de numerário na gaveta."
                            : "Regista uma retirada de numerário (sangria) para segurança ou depósito."}
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={{p: 2}}>
                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleSubmit}
                    disabled={amountInvalid || submitting}
                >
                    {submitting ? "A gravar..." : "Gravar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
