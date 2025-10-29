import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Divider,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
    CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveIcon from "@mui/icons-material/Save";
import InfoIcon from "@mui/icons-material/Info";

import TextFieldKeyboard from "../../components/Common/TextFieldKeyboard";
import PrinterService from "../../services/printer.service";
import OptionService from "../../services/option.service";
import {useToast} from "../../components/Common/ToastProvider";

const MAX_HEADER_LEN = 40;
const SAVE_DEBOUNCE_MS = 500;

function PrinterPage() {
    const {pushNetworkError, pushMessage} = useToast();

    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);

    const [printers, setPrinters] = useState([]);

    // Current values
    const [printer, setPrinter] = useState("");
    const [printType, setPrintType] = useState("totals");
    const [openDrawer, setOpenDrawer] = useState(false);
    const [firstLine, setFirstLine] = useState("");
    const [secondLine, setSecondLine] = useState("");
    const [printMethod, setPrintMethodState] = useState("shared");
    const [directConfig, setDirectConfig] = useState({
        type: "network",
        ip: "",
        port: 9100,
        devicePath: ""
    });

    // Original values (for change detection)
    const [originalPrinter, setOriginalPrinter] = useState("");
    const [originalPrintType, setOriginalPrintType] = useState("totals");
    const [originalOpenDrawer, setOriginalOpenDrawer] = useState(false);
    const [originalFirstLine, setOriginalFirstLine] = useState("");
    const [originalSecondLine, setOriginalSecondLine] = useState("");
    const [originalPrintMethod, setOriginalPrintMethod] = useState("shared");
    const [originalDirectConfig, setOriginalDirectConfig] = useState(null);

    // Validation & saving states
    const [firstErr, setFirstErr] = useState(false);
    const [secondErr, setSecondErr] = useState(false);
    const [savingPrintSettings, setSavingPrintSettings] = useState(false);
    const [savingHeaders, setSavingHeaders] = useState(false);
    const [savingPrintMethod, setSavingPrintMethod] = useState(false);
    const [savingDirectConfig, setSavingDirectConfig] = useState(false);

    const [usbDevices, setUsbDevices] = useState([]);
    const [loadingUSBDevices, setLoadingUSBDevices] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [printerDetails, setPrinterDetails] = useState(null);
    const [loadingPrinterDetails, setLoadingPrinterDetails] = useState(false);

    const debounceRef = useRef(null);
    const debounceSave = useCallback((fn) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fn, SAVE_DEBOUNCE_MS);
    }, []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const [listRes, printerRes, typeRes, headersRes, openDrawerRes, printMethodRes, directConfigRes] = await Promise.all([
                    PrinterService.getList(),
                    OptionService.getPrinter(),
                    OptionService.getPrintType(),
                    OptionService.getHeaders(),
                    OptionService.getOpenDrawer(),
                    OptionService.getPrintMethod(),
                    OptionService.getDirectPrintConfig(),
                ]);

                if (!mounted) return;

                setPrinters(listRes.data || []);

                const printerName = printerRes?.data?.name ?? "";
                const printTypeValue = typeRes?.data || "totals";
                const openDrawerValue = Boolean(openDrawerRes?.data?.openDrawer);
                const firstLineValue = headersRes?.data?.firstLine || "";
                const secondLineValue = headersRes?.data?.secondLine || "";
                const printMethodValue = printMethodRes?.data?.printMethod || "shared";
                const loadedConfig = directConfigRes?.data?.config || {
                    type: "network",
                    ip: "",
                    port: 9100,
                    devicePath: ""
                };

                // Set current values
                setPrinter(printerName);
                setPrintType(printTypeValue);
                setOpenDrawer(openDrawerValue);
                setFirstLine(firstLineValue);
                setSecondLine(secondLineValue);
                setPrintMethodState(printMethodValue);
                setDirectConfig(loadedConfig);

                // Set original values
                setOriginalPrinter(printerName);
                setOriginalPrintType(printTypeValue);
                setOriginalOpenDrawer(openDrawerValue);
                setOriginalFirstLine(firstLineValue);
                setOriginalSecondLine(secondLineValue);
                setOriginalPrintMethod(printMethodValue);
                setOriginalDirectConfig(loadedConfig);
            } catch (error) {
                pushNetworkError(error, {
                    title: "Não foi possível carregar as configurações de impressão",
                });
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [pushNetworkError]);

    const onChangePrinter = (event) => {
        setPrinter(event.target.value);
    };

    const onChangePrintType = (event) => {
        setPrintType(event.target.value);
    };

    const onChangeOpenDrawer = (event) => {
        setOpenDrawer(event.target.checked);
    };

    const validateHeaderLine = useCallback((value, isFirstLine) => {
        if (isFirstLine) {
            return value.length === 0 || value.length > MAX_HEADER_LEN;
        }
        return value.length > MAX_HEADER_LEN;
    }, []);

    const onChangeFirst = (val) => {
        const value = val ?? "";
        setFirstLine(value);
        setFirstErr(validateHeaderLine(value, true));
    };

    const onChangeSecond = (val) => {
        const value = val ?? "";
        setSecondLine(value);
        setSecondErr(validateHeaderLine(value, false));
    };

    const handleTestPrint = async () => {
        try {
            setTesting(true);
            await PrinterService.printTicket({
                test: true,
                headers: {firstLine, secondLine},
                printType,
                printer,
                openDrawer,
            });
            pushMessage("success", "Impressão de teste enviada.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível enviar a impressão de teste"});
        } finally {
            setTesting(false);
        }
    };

    const onChangePrintMethod = (event) => {
        setPrintMethodState(event.target.value);
    };

    const onChangeDirectConfig = (field, value) => {
        const newConfig = {...directConfig, [field]: value};
        setDirectConfig(newConfig);
    };

    // Save handlers
    const handleSavePrintSettings = async () => {
        try {
            setSavingPrintSettings(true);

            // Save all print settings
            await Promise.all([
                printer !== originalPrinter ? OptionService.setPrinter(printer) : Promise.resolve(),
                printType !== originalPrintType ? OptionService.setPrintType(printType) : Promise.resolve(),
                openDrawer !== originalOpenDrawer ? OptionService.setOpenDrawer(openDrawer) : Promise.resolve(),
            ]);

            // Update originals
            setOriginalPrinter(printer);
            setOriginalPrintType(printType);
            setOriginalOpenDrawer(openDrawer);

            pushMessage("success", "Configurações de impressão guardadas.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível guardar as configurações"});
        } finally {
            setSavingPrintSettings(false);
        }
    };

    const handleSaveHeaders = async () => {
        if (firstErr || secondErr) {
            pushMessage("error", "Corrige os erros antes de guardar.");
            return;
        }

        try {
            setSavingHeaders(true);

            await Promise.all([
                firstLine !== originalFirstLine ? OptionService.setHeaderFirstLine(firstLine) : Promise.resolve(),
                secondLine !== originalSecondLine ? OptionService.setHeaderSecondLine(secondLine) : Promise.resolve(),
            ]);

            setOriginalFirstLine(firstLine);
            setOriginalSecondLine(secondLine);

            pushMessage("success", "Cabeçalhos guardados.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível guardar os cabeçalhos"});
        } finally {
            setSavingHeaders(false);
        }
    };

    const handleSavePrintMethod = async () => {
        try {
            setSavingPrintMethod(true);

            const promises = [];

            if (printMethod !== originalPrintMethod) {
                promises.push(OptionService.setPrintMethod(printMethod));
            }

            // If shared method and printer changed
            if (printMethod === "shared" && printer !== originalPrinter) {
                promises.push(OptionService.setPrinter(printer));
            }

            await Promise.all(promises);

            setOriginalPrintMethod(printMethod);
            if (printMethod === "shared") {
                setOriginalPrinter(printer);
            }

            pushMessage("success", "Método de impressão guardado.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível guardar o método de impressão"});
        } finally {
            setSavingPrintMethod(false);
        }
    };

    const handleSaveDirectConfig = async () => {
        try {
            setSavingDirectConfig(true);
            await OptionService.setDirectPrintConfig(directConfig);
            setOriginalDirectConfig(directConfig);
            pushMessage("success", "Configuração de impressão direta guardada.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível guardar a configuração de impressão direta"});
        } finally {
            setSavingDirectConfig(false);
        }
    };

    // Change detection
    const hasPrintSettingsChanges = useMemo(() => {
        return printType !== originalPrintType || openDrawer !== originalOpenDrawer;
    }, [printType, originalPrintType, openDrawer, originalOpenDrawer]);

    const hasHeaderChanges = useMemo(() => {
        return firstLine !== originalFirstLine || secondLine !== originalSecondLine;
    }, [firstLine, originalFirstLine, secondLine, originalSecondLine]);

    const hasPrintMethodChanges = useMemo(() => {
        if (printMethod !== originalPrintMethod) return true;
        if (printMethod === "shared" && printer !== originalPrinter) return true;
        return false;
    }, [printMethod, originalPrintMethod, printer, originalPrinter]);

    const hasDirectConfigChanges = useMemo(() => {
        if (!originalDirectConfig) return false;
        return JSON.stringify(directConfig) !== JSON.stringify(originalDirectConfig);
    }, [directConfig, originalDirectConfig]);

    const loadUSBDevices = async () => {
        try {
            setLoadingUSBDevices(true);
            const res = await PrinterService.getUSBDevices();
            const devices = res.data || [];
            setUsbDevices(devices);

            if (devices.length === 0) {
                pushMessage("info", "Nenhum dispositivo USB encontrado. Certifica-te que a impressora está ligada.");
            } else {
                pushMessage("success", `${devices.length} dispositivo(s) encontrado(s).`);
            }
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível listar dispositivos USB"});
        } finally {
            setLoadingUSBDevices(false);
        }
    };

    const handleTestDirectConnection = async () => {
        try {
            setTestingConnection(true);
            const res = await PrinterService.testDirectConnection(directConfig);
            if (res.data?.success) {
                pushMessage("success", res.data.message || "Conexão bem-sucedida!");
            } else {
                pushMessage("error", res.data?.message || "Falha na conexão");
            }
        } catch (error) {
            pushNetworkError(error, {title: "Erro ao testar conexão"});
        } finally {
            setTestingConnection(false);
        }
    };

    const handleGetPrinterDetails = async () => {
        if (!printer) {
            pushMessage("warning", "Seleciona uma impressora primeiro.");
            return;
        }

        try {
            setLoadingPrinterDetails(true);
            const res = await PrinterService.getPrinterDetails(printer);
            setPrinterDetails(res.data);

            // Show recommendations
            if (res.data?.recommendations && res.data.recommendations.length > 0) {
                const firstRec = res.data.recommendations[0];
                pushMessage("info", `${firstRec.message} ${firstRec.suggestion}`);
            }
        } catch (error) {
            pushNetworkError(error, {title: "Erro ao obter detalhes da impressora"});
        } finally {
            setLoadingPrinterDetails(false);
        }
    };

    const printerMenu = useMemo(() => printers.map((p) => (
        <MenuItem key={p.systemName} value={p.systemName}>
            {p.name}
        </MenuItem>
    )), [printers]);

    return (
        <Stack spacing={3}>
            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Tipo de impressão</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Decide se imprime apenas o resumo final, cada bilhete individual, ou ambos.
                        </Typography>
                    </Box>

                    {loading ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CircularProgress size={20}/>
                            <Typography variant="body2">A carregar configurações…</Typography>
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            {hasPrintSettingsChanges && (
                                <Alert severity="warning">
                                    Existem alterações não guardadas.
                                </Alert>
                            )}

                            <FormControl fullWidth disabled={savingPrintSettings}>
                                <InputLabel id="print-type-select-label">Tipo de impressão</InputLabel>
                                <Select
                                    labelId="print-type-select-label"
                                    id="print-type-select"
                                    label="Tipo de impressão"
                                    value={printType}
                                    onChange={onChangePrintType}
                                >
                                    <MenuItem value="totals">Resumo por Totais</MenuItem>
                                    <MenuItem value="tickets">Bilhetes individuais</MenuItem>
                                    <MenuItem value="both">Resumos e Bilhetes</MenuItem>
                                </Select>
                                <FormHelperText>
                                    Escolhe o formato de talão a imprimir.
                                </FormHelperText>
                            </FormControl>

                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Switch
                                    id="open-drawer-switch"
                                    checked={openDrawer}
                                    onChange={onChangeOpenDrawer}
                                    disabled={savingPrintSettings}
                                />
                                <Box>
                                    <Typography variant="subtitle2">Abrir gaveta de dinheiro</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Quando suportado pela impressora, envia comando de abertura após imprimir.
                                    </Typography>
                                </Box>
                            </Stack>

                            <LoadingButton
                                variant="contained"
                                loading={savingPrintSettings}
                                startIcon={<SaveIcon />}
                                onClick={handleSavePrintSettings}
                                disabled={!hasPrintSettingsChanges}
                                sx={{alignSelf: "flex-start"}}
                            >
                                Guardar Configurações
                            </LoadingButton>
                        </Stack>
                    )}
                </Stack>
            </Paper>

            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Método de Impressão</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Escolha entre impressora partilhada (lento) ou conexão direta (rápido).
                        </Typography>
                    </Box>

                    {loading ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CircularProgress size={20}/>
                            <Typography variant="body2">A carregar configurações…</Typography>
                        </Stack>
                    ) : (
                        <>
                            {hasPrintMethodChanges && (
                                <Alert severity="warning">
                                    Existem alterações não guardadas.
                                </Alert>
                            )}

                            <FormControl component="fieldset" disabled={savingPrintMethod}>
                                <RadioGroup value={printMethod} onChange={onChangePrintMethod}>
                                    <FormControlLabel
                                        value="shared"
                                        control={<Radio />}
                                        label="Impressora Partilhada (Fallback - Mais lento)"
                                    />
                                    <FormControlLabel
                                        value="direct"
                                        control={<Radio />}
                                        label="Conexão Direta (Recomendado - Mais rápido)"
                                    />
                                </RadioGroup>
                            </FormControl>

                            {printMethod === "shared" && (
                                <Stack spacing={2} sx={{ml: 2, pl: 2, borderLeft: theme => `2px solid ${theme.palette.divider}`}}>
                                    <Alert severity="info">
                                        Utiliza o spooler do sistema operativo. Mais lento mas funciona com qualquer impressora configurada.
                                    </Alert>

                                    <FormControl fullWidth disabled={savingPrintMethod}>
                                        <InputLabel id="printer-select-label">Impressora</InputLabel>
                                        <Select
                                            labelId="printer-select-label"
                                            id="printer-select"
                                            label="Impressora"
                                            value={printer}
                                            onChange={onChangePrinter}
                                        >
                                            {printerMenu}
                                        </Select>
                                        <FormHelperText>
                                            Seleciona a impressora do sistema a utilizar.
                                        </FormHelperText>
                                    </FormControl>

                                    <LoadingButton
                                        variant="outlined"
                                        loading={loadingPrinterDetails}
                                        startIcon={<InfoIcon />}
                                        onClick={handleGetPrinterDetails}
                                        disabled={!printer || savingPrintMethod}
                                        sx={{alignSelf: "flex-start"}}
                                    >
                                        Ver Detalhes da Impressora
                                    </LoadingButton>

                                    {printerDetails && (
                                        <Alert severity="info" sx={{whiteSpace: "pre-wrap"}}>
                                            <Typography variant="subtitle2" fontWeight={600}>
                                                Detalhes: {printerDetails.printer?.Name}
                                            </Typography>
                                            <Typography variant="body2" sx={{mt: 1}}>
                                                <strong>Porta:</strong> {printerDetails.printer?.PortName}
                                            </Typography>
                                            {printerDetails.port && (
                                                <Typography variant="body2">
                                                    <strong>Monitor:</strong> {printerDetails.port?.PortMonitor}
                                                </Typography>
                                            )}
                                            {printerDetails.recommendations && printerDetails.recommendations.length > 0 && (
                                                <Box sx={{mt: 2}}>
                                                    <Typography variant="subtitle2" fontWeight={600}>
                                                        Recomendações:
                                                    </Typography>
                                                    {printerDetails.recommendations.map((rec, idx) => (
                                                        <Typography key={idx} variant="body2" sx={{mt: 0.5}}>
                                                            • {rec.message}
                                                            <br />
                                                            <em>{rec.suggestion}</em>
                                                        </Typography>
                                                    ))}
                                                </Box>
                                            )}
                                        </Alert>
                                    )}

                                    <LoadingButton
                                        variant="contained"
                                        loading={savingPrintMethod}
                                        startIcon={<SaveIcon />}
                                        onClick={handleSavePrintMethod}
                                        disabled={!hasPrintMethodChanges}
                                        sx={{alignSelf: "flex-start"}}
                                    >
                                        Guardar Método
                                    </LoadingButton>
                                </Stack>
                            )}

                            {printMethod === "direct" && (
                                <Stack spacing={2} sx={{ml: 2, pl: 2, borderLeft: theme => `2px solid ${theme.palette.divider}`}}>
                                    <Alert severity="info">
                                        A impressão direta envia comandos diretamente para a impressora, sem usar o spooler do sistema.
                                    </Alert>

                                    {(hasPrintMethodChanges || hasDirectConfigChanges) && (
                                        <Alert severity="warning">
                                            Existem alterações não guardadas.
                                        </Alert>
                                    )}

                                    <FormControl fullWidth disabled={savingPrintMethod || savingDirectConfig}>
                                <InputLabel id="connection-type-label">Tipo de Conexão</InputLabel>
                                <Select
                                    labelId="connection-type-label"
                                    label="Tipo de Conexão"
                                    value={directConfig.type}
                                    onChange={(e) => onChangeDirectConfig("type", e.target.value)}
                                >
                                    <MenuItem value="network">Rede (TCP/IP)</MenuItem>
                                    <MenuItem value="usb">USB</MenuItem>
                                    <MenuItem value="serial">Serial (COM)</MenuItem>
                                </Select>
                            </FormControl>

                                    {directConfig.type === "network" && (
                                        <Stack spacing={2}>
                                            <TextField
                                                label="Endereço IP"
                                                fullWidth
                                                value={directConfig.ip}
                                                onChange={(e) => onChangeDirectConfig("ip", e.target.value)}
                                                placeholder="192.168.1.100"
                                                disabled={savingPrintMethod || savingDirectConfig}
                                                helperText="Endereço IP da impressora na rede"
                                            />
                                            <TextField
                                                label="Porta"
                                                type="number"
                                                fullWidth
                                                value={directConfig.port}
                                                onChange={(e) => onChangeDirectConfig("port", parseInt(e.target.value))}
                                                disabled={savingPrintMethod || savingDirectConfig}
                                                helperText="Porta raw printing (geralmente 9100)"
                                            />
                                        </Stack>
                                    )}

                                    {(directConfig.type === "usb" || directConfig.type === "serial") && (
                                        <Stack spacing={2}>
                                            <Stack direction="row" spacing={1}>
                                                <TextField
                                                    label="Caminho do Dispositivo"
                                                    fullWidth
                                                    value={directConfig.devicePath}
                                                    onChange={(e) => onChangeDirectConfig("devicePath", e.target.value)}
                                                    placeholder="Ex: 0x0425:0x0101"
                                                    disabled={savingPrintMethod || savingDirectConfig}
                                                    helperText="VID:PID da impressora USB (use o botão Listar para descobrir)"
                                                />
                                                <LoadingButton
                                                    variant="outlined"
                                                    startIcon={<RefreshIcon />}
                                                    onClick={loadUSBDevices}
                                                    loading={loadingUSBDevices}
                                                    disabled={savingPrintMethod || savingDirectConfig}
                                                    sx={{flexShrink: 0}}
                                                >
                                                    Listar
                                                </LoadingButton>
                                            </Stack>

                                    {usbDevices.length > 0 && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Dispositivos encontrados:
                                            </Typography>
                                            <Stack spacing={0.5} sx={{mt: 1}}>
                                                {usbDevices.map((device, idx) => {
                                                    // Handle both old format (string) and new format (object)
                                                    const displayText = typeof device === 'string'
                                                        ? device
                                                        : device.displayName || `${device.product || 'USB Printer'} (${device.identifier})`;
                                                    const deviceValue = typeof device === 'string'
                                                        ? device
                                                        : device.identifier;

                                                    return (
                                                        <Button
                                                            key={idx}
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => onChangeDirectConfig("devicePath", deviceValue)}
                                                            sx={{justifyContent: "flex-start", textTransform: "none"}}
                                                        >
                                                            {displayText}
                                                        </Button>
                                                    );
                                                })}
                                            </Stack>
                                        </Box>
                                    )}
                                </Stack>
                            )}

                                    <Stack direction="row" spacing={2} flexWrap="wrap">
                                        {hasPrintMethodChanges && (
                                            <LoadingButton
                                                variant="contained"
                                                loading={savingPrintMethod}
                                                startIcon={<SaveIcon />}
                                                onClick={handleSavePrintMethod}
                                                disabled={!hasPrintMethodChanges || savingDirectConfig}
                                                sx={{alignSelf: "flex-start"}}
                                            >
                                                Guardar Método
                                            </LoadingButton>
                                        )}

                                        <LoadingButton
                                            variant={hasDirectConfigChanges ? "contained" : "outlined"}
                                            loading={savingDirectConfig}
                                            startIcon={<SaveIcon />}
                                            onClick={handleSaveDirectConfig}
                                            disabled={!hasDirectConfigChanges || savingPrintMethod}
                                            sx={{alignSelf: "flex-start"}}
                                        >
                                            {hasDirectConfigChanges ? "Guardar Configuração" : "Configuração Guardada"}
                                        </LoadingButton>

                                        <LoadingButton
                                            variant="outlined"
                                            loading={testingConnection}
                                            startIcon={<CheckCircleIcon />}
                                            onClick={handleTestDirectConnection}
                                            disabled={
                                                savingPrintMethod ||
                                                savingDirectConfig ||
                                                hasPrintMethodChanges ||
                                                hasDirectConfigChanges ||
                                                (directConfig.type === "network" && !directConfig.ip) ||
                                                ((directConfig.type === "usb" || directConfig.type === "serial") && !directConfig.devicePath)
                                            }
                                            sx={{alignSelf: "flex-start"}}
                                        >
                                            Testar Conexão
                                        </LoadingButton>
                                    </Stack>
                                </Stack>
                            )}
                        </>
                    )}
                </Stack>
            </Paper>

            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Cabeçalho do talão</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Personaliza as linhas superiores impressas em cada talão.
                        </Typography>
                    </Box>

                    {hasHeaderChanges && (
                        <Alert severity="warning">
                            Existem alterações não guardadas.
                        </Alert>
                    )}

                    <TextFieldKeyboard
                        value={firstLine}
                        onChange={onChangeFirst}
                        maxLength={MAX_HEADER_LEN}
                        showSymbols={false}
                        textFieldProps={{
                            label: "Primeira linha",
                            fullWidth: true,
                            required: true,
                            helperText: firstErr
                                ? `Obrigatória e até ${MAX_HEADER_LEN} caracteres.`
                                : `${firstLine?.length || 0}/${MAX_HEADER_LEN}`,
                            error: firstErr,
                        }}
                    />

                    <TextFieldKeyboard
                        value={secondLine}
                        onChange={onChangeSecond}
                        maxLength={MAX_HEADER_LEN}
                        showSymbols={false}
                        textFieldProps={{
                            label: "Segunda linha",
                            fullWidth: true,
                            helperText: secondErr
                                ? `Até ${MAX_HEADER_LEN} caracteres.`
                                : `${secondLine?.length || 0}/${MAX_HEADER_LEN}`,
                            error: secondErr,
                        }}
                    />

                    {(firstErr || secondErr) && (
                        <Alert severity="error">
                            Corrige os erros antes de guardar.
                        </Alert>
                    )}

                    <LoadingButton
                        variant="contained"
                        loading={savingHeaders}
                        startIcon={<SaveIcon />}
                        onClick={handleSaveHeaders}
                        disabled={!hasHeaderChanges || firstErr || secondErr}
                        sx={{alignSelf: "flex-start"}}
                    >
                        Guardar Cabeçalhos
                    </LoadingButton>
                </Stack>
            </Paper>

            <Divider/>

            <LoadingButton
                onClick={handleTestPrint}
                loading={testing}
                variant="contained"
                startIcon={<PrintRoundedIcon/>}
                sx={{alignSelf: {xs: "stretch", sm: "flex-start"}}}
            >
                Testar impressão
            </LoadingButton>
        </Stack>
    );
}

export default PrinterPage;
