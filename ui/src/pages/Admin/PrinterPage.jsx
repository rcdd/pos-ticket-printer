import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Alert,
    Box,
    Divider,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Typography,
    CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";

import TextFieldKeyboard from "../../components/Common/TextFieldKeyboard";
import PrinterService from "../../services/printer.service";
import OptionService from "../../services/option.service";
import {useToast} from "../../components/Common/ToastProvider";

const MAX_HEADER_LEN = 40;
const SAVE_DEBOUNCE_MS = 500;

function PrinterPage() {
    const {pushNetworkError, pushMessage} = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [printers, setPrinters] = useState([]);
    const [printer, setPrinter] = useState("");
    const [printType, setPrintType] = useState("totals");
    const [openDrawer, setOpenDrawer] = useState(false);

    const [firstLine, setFirstLine] = useState("");
    const [secondLine, setSecondLine] = useState("");
    const [firstErr, setFirstErr] = useState(false);
    const [secondErr, setSecondErr] = useState(false);

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
                const [listRes, printerRes, typeRes, headersRes, openDrawerRes] = await Promise.all([
                    PrinterService.getList(),
                    OptionService.getPrinter(),
                    OptionService.getPrintType(),
                    OptionService.getHeaders(),
                    OptionService.getOpenDrawer(),
                ]);

                if (!mounted) return;

                setPrinters(listRes.data || []);
                setPrinter(printerRes?.data?.name ?? "");
                setPrintType(typeRes?.data || "totals");
                setFirstLine(headersRes?.data?.firstLine || "");
                setSecondLine(headersRes?.data?.secondLine || "");
                setOpenDrawer(Boolean(openDrawerRes?.data?.openDrawer));
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

    const onChangePrinter = async (event) => {
        const value = event.target.value;
        try {
            setSaving(true);
            await OptionService.setPrinter(value);
            setPrinter(value);
            pushMessage("success", "Impressora atualizada.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível alterar a impressora"});
        } finally {
            setSaving(false);
        }
    };

    const onChangePrintType = async (event) => {
        const value = event.target.value;
        try {
            setSaving(true);
            await OptionService.setPrintType(value);
            setPrintType(value);
            pushMessage("success", "Tipo de impressão atualizado.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível alterar o tipo de impressão"});
        } finally {
            setSaving(false);
        }
    };

    const persistHeaderLine = useCallback(async (value, setter, errSetter, request) => {
        const invalid = request === "first"
            ? value.length === 0 || value.length > MAX_HEADER_LEN
            : value.length > MAX_HEADER_LEN;
        errSetter(invalid);
        setter(value);
        debounceSave(async () => {
            if (invalid) return;
            try {
                setSaving(true);
                if (request === "first") {
                    await OptionService.setHeaderFirstLine(value);
                } else {
                    await OptionService.setHeaderSecondLine(value);
                }
            } catch (error) {
                const title = request === "first"
                    ? "Não foi possível alterar a primeira linha do cabeçalho"
                    : "Não foi possível alterar a segunda linha do cabeçalho";
                pushNetworkError(error, {title});
            } finally {
                setSaving(false);
            }
        });
    }, [debounceSave, pushNetworkError]);

    const onChangeFirst = (val) => {
        persistHeaderLine(val ?? "", setFirstLine, setFirstErr, "first");
    };

    const onChangeSecond = (val) => {
        persistHeaderLine(val ?? "", setSecondLine, setSecondErr, "second");
    };

    const onChangeOpenDrawer = async (event) => {
        const value = event.target.checked;
        try {
            setSaving(true);
            await OptionService.setOpenDrawer(value);
            setOpenDrawer(value);
            pushMessage("success", "Opção de gaveta atualizada.");
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível alterar a opção de abrir gaveta"});
        } finally {
            setSaving(false);
        }
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
                        <Typography variant="h5" fontWeight={700}>Impressora</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Seleciona o dispositivo padrão e o tipo de talão utilizado no POS.
                        </Typography>
                    </Box>

                    {loading ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CircularProgress size={20}/>
                            <Typography variant="body2">A carregar lista de impressoras…</Typography>
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            <FormControl fullWidth disabled={saving}>
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
                                    Define a impressora do sistema a utilizar para o POS.
                                </FormHelperText>
                            </FormControl>

                            <FormControl fullWidth disabled={saving}>
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
                                    Decide se imprime apenas o resumo final, cada bilhete individual, ou ambos.
                                </FormHelperText>
                            </FormControl>

                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Switch
                                    id="open-drawer-switch"
                                    checked={openDrawer}
                                    onChange={onChangeOpenDrawer}
                                    disabled={saving}
                                />
                                <Box>
                                    <Typography variant="subtitle2">Abrir gaveta de dinheiro</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Quando suportado pela impressora, envia comando de abertura após imprimir.
                                    </Typography>
                                </Box>
                            </Stack>
                        </Stack>
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
                        <Alert severity="warning">
                            Verifique o comprimento das linhas antes de guardar.
                        </Alert>
                    )}
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
