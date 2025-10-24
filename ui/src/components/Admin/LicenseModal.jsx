import React from "react";
import {
    Alert,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import Button from "@mui/material/Button";
import TextFieldKeyboard from "../Common/TextFieldKeyboard.jsx";
import LicenseService from "../../services/license.service.js";

export default function LicenseModal({open, status, onApplied, onClose}) {
    const [code, setCode] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        if (open) {
            setCode("");
            setError("");
        }
    }, [open]);

    const applyCode = async () => {
        if (!code?.trim()) {
            setError("Introduza o código de licença.");
            return;
        }

        setSubmitting(true);
        try {
            const {data} = await LicenseService.apply(code.trim());
            setError("");
            if (onApplied) {
                await onApplied(data);
            }
            setCode("");
        } catch (err) {
            const message = err?.response?.data?.message || "Não foi possível ativar a licença.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            maxWidth="sm"
            fullWidth
            disableEscapeKeyDown
            aria-labelledby="license-dialog-title"
        >
            <DialogTitle id="license-dialog-title">Ativação da Licença</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body1">
                        Para continuar a utilizar o sistema introduza o código de licença fornecido.
                    </Typography>

                    {status?.installationCode && (
                        <Alert severity="info">
                            Código de instalação:{" "}
                            <Typography
                                component="span"
                                variant="body1"
                                sx={{fontFamily: "monospace", fontWeight: 600, letterSpacing: 1, ml: 0.5}}
                            >
                                {status.installationCode}
                            </Typography>
                        </Alert>
                    )}

                    {status?.message && (
                        <Alert severity={status.valid ? "success" : "warning"}>{status.message}</Alert>
                    )}

                    <Box>
                        <TextFieldKeyboard
                            value={code}
                            onChange={setCode}
                            onEnter={applyCode}
                            maxLength={32}
                            textFieldProps={{
                                label: "Código da licença",
                                fullWidth: true,
                                placeholder: "XXXX-XXX-XXXXXX",
                            }}
                        />
                    </Box>

                    {error && (
                        <Alert severity="error">{error}</Alert>
                    )}

                    <Typography variant="body2" color="text.secondary">
                        O código pode incluir letras e números. Utilize o teclado virtual para facilitar a introdução
                        em ecrãs tácteis.
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                {onClose && (
                    <Button onClick={onClose} disabled={submitting}>
                        Cancelar
                    </Button>
                )}
                <LoadingButton
                    variant="contained"
                    color="primary"
                    loading={submitting}
                    onClick={applyCode}
                >
                    Ativar
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
