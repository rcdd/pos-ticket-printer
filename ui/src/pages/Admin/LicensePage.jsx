import React from "react";
import {
    Alert,
    Box,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Grid,
    Stack,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import Button from "@mui/material/Button";
import TextFieldKeyboard from "../../components/Common/TextFieldKeyboard.jsx";
import LicenseService from "../../services/license.service.js";
import dayjs from "dayjs";

const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

const formatDate = (value) => {
    if (!value) return "—";
    return dayjs(value).format("YYYY-MM-DD");
};

const computeDaysRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = expiresAt - Date.now();
    return diff <= 0 ? 0 : Math.ceil(diff / MILLIS_IN_DAY);
};

export default function LicensePage() {
    const [loading, setLoading] = React.useState(true);
    const [details, setDetails] = React.useState(null);
    const [error, setError] = React.useState("");
    const [code, setCode] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [clearing, setClearing] = React.useState(false);
    const [successMessage, setSuccessMessage] = React.useState("");

    const fetchDetails = React.useCallback(async () => {
        setLoading(true);
        setError("");
        setSuccessMessage("");
        try {
            const {data} = await LicenseService.getDetails();
            setDetails(data);
        } catch (err) {
            const message = err?.response?.data?.message || "Não foi possível carregar os dados da licença.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const applyCode = async () => {
        if (!code?.trim()) {
            setError("Introduza um código de licença.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccessMessage("");

        try {
            const {data} = await LicenseService.apply(code.trim());
            setDetails(data);
            setSuccessMessage("Licença atualizada com sucesso.");
            setCode("");
            window.dispatchEvent(new CustomEvent("license:updated", {detail: data}));
        } catch (err) {
            const message = err?.response?.data?.message || "Não foi possível aplicar a licença.";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const clearLicense = async () => {
        if (!window.confirm("Remover a licença atual? Será necessário introduzir um novo código para voltar a utilizar o sistema.")) {
            return;
        }

        setClearing(true);
        setError("");
        setSuccessMessage("");

        try {
            const {data} = await LicenseService.remove();
            setDetails(data);
            setSuccessMessage("Licença removida. O sistema ficará bloqueado até inserir um novo código.");
            window.dispatchEvent(new CustomEvent("license:updated", {detail: data}));
        } catch (err) {
            const message = err?.response?.data?.message || "Não foi possível remover a licença.";
            setError(message);
        } finally {
            setClearing(false);
        }
    };

    const statusColor = details?.valid ? "success" : "warning";
    const daysRemaining = computeDaysRemaining(details?.expiresAt);

    return (
        <Stack spacing={3}>
            <Box>
                <Typography variant="h4" gutterBottom>Licença</Typography>
                <Typography variant="body1" color="text.secondary">
                    Gere o código de licença utilizado para ativar o sistema. Pode atualizar o código manualmente ou remover a licença atual para instalar uma nova.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            {successMessage && (
                <Alert severity="success" onClose={() => setSuccessMessage("")}>
                    {successMessage}
                </Alert>
            )}

            <Card>
                <CardHeader title="Estado Atual"/>
                <CardContent>
                    {loading ? (
                        <Typography variant="body2">A carregar...</Typography>
                    ) : (
                        <Stack spacing={2}>
                            <Alert severity={statusColor}>
                                {details?.message || "Não existe licença ativa."}
                            </Alert>

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Cliente</Typography>
                                    <Typography variant="body1">{details?.tenant || "—"}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Expira em</Typography>
                                    <Typography variant="body1">{formatDate(details?.expiresAtIso || details?.expiresAt)}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Dias restantes</Typography>
                                    <Typography variant="body1">{daysRemaining ?? "—"}</Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Última verificação</Typography>
                                    <Typography variant="body1">{formatDate(details?.lastCheckedAt)}</Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary">Código atual</Typography>
                                    <Typography variant="body1" sx={{fontFamily: "monospace", letterSpacing: 1}}>
                                        {details?.token || "—"}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Stack>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader title="Atualizar código"/>
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            Introduza o novo código de licença fornecido.
                        </Typography>

                        <TextFieldKeyboard
                            value={code}
                            onChange={setCode}
                            onEnter={applyCode}
                            maxLength={32}
                            textFieldProps={{
                                label: "Novo código",
                                fullWidth: true,
                                placeholder: "XXXX-XXX-XXXXXX",
                            }}
                        />

                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button
                                color="error"
                                variant="outlined"
                                onClick={clearLicense}
                                disabled={clearing || saving}
                            >
                                Remover licença
                            </Button>
                            <LoadingButton
                                variant="contained"
                                loading={saving}
                                onClick={applyCode}
                            >
                                Guardar
                            </LoadingButton>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
