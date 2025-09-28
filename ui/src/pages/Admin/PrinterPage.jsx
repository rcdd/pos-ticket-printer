import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Box,
    Divider,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
    CircularProgress,
} from "@mui/material";
import TextFieldKeyboard from "../../components/Common/TextFieldKeyboard";
import PrinterService from "../../services/printer.service";
import OptionService from "../../services/option.service";
import {useToast} from "../../components/Common/ToastProvider";
import LoadingButton from "@mui/lab/LoadingButton";

const MAX_HEADER_LEN = 40;

function PrintRoundedIcon() {
    return null;
}

export default function PrinterPage() {
    const {pushNetworkError} = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [printers, setPrinters] = useState([]);
    const [printer, setPrinter] = useState("");
    const [printType, setPrintType] = useState("totals");

    const [firstLine, setFirstLine] = useState("");
    const [secondLine, setSecondLine] = useState("");

    const [firstErr, setFirstErr] = useState(false);
    const [secondErr, setSecondErr] = useState(false);

    const debounceRef = useRef(null);
    const debounceSave = useCallback((fn) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fn, 500);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [listRes, printerRes, typeRes, headersRes] = await Promise.all([
                    PrinterService.getList(),
                    OptionService.getPrinter(),
                    OptionService.getPrintType(),
                    OptionService.getHeaders(),
                ]);

                setPrinters(listRes.data || []);
                setPrinter(printerRes?.data?.name ?? "");
                setPrintType(typeRes?.data || "totals");
                setFirstLine(headersRes?.data?.firstLine || "");
                setSecondLine(headersRes?.data?.secondLine || "");
            } catch (error) {
                pushNetworkError(error, {
                    title: "Não foi possível carregar as configurações de impressão",
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [pushNetworkError]);

    const onChangePrinter = async (e) => {
        const value = e.target.value;
        try {
            setSaving(true);
            await OptionService.setPrinter(value);
            setPrinter(value);
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível alterar a impressora"});
        } finally {
            setSaving(false);
        }
    };

    const onChangePrintType = async (e) => {
        const value = e.target.value;
        try {
            setSaving(true);
            await OptionService.setPrintType(value);
            setPrintType(value);
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível alterar o tipo de impressão"});
        } finally {
            setSaving(false);
        }
    };

    const onChangeFirst = (val) => {
        const value = val ?? "";
        setFirstLine(value);
        const invalid = value.length === 0 || value.length > MAX_HEADER_LEN;
        setFirstErr(invalid);
        debounceSave(async () => {
            if (invalid) return;
            try {
                setSaving(true);
                await OptionService.setHeaderFirstLine(value);
            } catch (error) {
                pushNetworkError(error, {title: "Não foi possível alterar a primeira linha do cabeçalho"});
            } finally {
                setSaving(false);
            }
        });
    };

    const onChangeSecond = (val) => {
        const value = val ?? "";
        setSecondLine(value);
        const invalid = value.length > MAX_HEADER_LEN;
        setSecondErr(invalid);
        debounceSave(async () => {
            if (invalid) return;
            try {
                setSaving(true);
                await OptionService.setHeaderSecondLine(value);
            } catch (error) {
                pushNetworkError(error, {title: "Não foi possível alterar a segunda linha do cabeçalho"});
            } finally {
                setSaving(false);
            }
        });
    };

    const handleTestPrint = async () => {
        try {
            setTesting(true);
            await PrinterService.print({
                items: [
                    {
                        id: "TEST",
                        name: "=== TESTE DE IMPRESSÃO ===",
                        quantity: 1,
                        price: 0,
                        totalAmount: 0,
                        type: "Test"
                    },
                ],
                totalAmount: "0.00",
                test: true,
                headers: {firstLine, secondLine},
                printType,
                printer,
            });
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível enviar a impressão de teste"});
        } finally {
            setTesting(false);
        }
    };

    const printerMenu = useMemo(
        () =>
            printers.map((p) => (
                <MenuItem key={p.name} value={p.name}>
                    {p.name}
                </MenuItem>
            )),
        [printers]
    );

    return (
        <Box>
            {loading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={20}/>
                    <Typography variant="body2">A carregar…</Typography>
                </Stack>
            ) : (
                <Stack spacing={4}>
                    <Box>
                        <Typography variant="h6" sx={{mb: 2}}>
                            Instalação
                        </Typography>

                        <Stack spacing={2}>
                            <FormControl fullWidth disabled={saving}>
                                <InputLabel id="printer-select-label">Impressora</InputLabel>
                                <Select
                                    labelId="printer-select-label"
                                    id="printer-select"
                                    label="Impressora"
                                    value={printer}
                                    onChange={onChangePrinter}
                                    variant="outlined">
                                    {printerMenu}
                                </Select>
                                <FormHelperText>
                                    Seleciona a impressora do sistema. {saving && "A guardar…"}
                                </FormHelperText>
                            </FormControl>

                            <FormControl fullWidth disabled={saving}>
                                <InputLabel id="print-type-select-label">Tipo de Impressão</InputLabel>
                                <Select
                                    labelId="print-type-select-label"
                                    id="print-type-select"
                                    label="Tipo de Impressão"
                                    value={printType}
                                    onChange={onChangePrintType}
                                    variant="outlined">
                                    <MenuItem value="totals">Totais</MenuItem>
                                    <MenuItem value="tickets">Individuais</MenuItem>
                                    <MenuItem value="both">Ambos</MenuItem>
                                </Select>
                                <FormHelperText>
                                    Define se imprime só totais, bilhetes individuais ou ambos.
                                </FormHelperText>
                            </FormControl>
                        </Stack>
                    </Box>

                    <Divider/>

                    <Box>
                        <Typography variant="h6" sx={{mb: 2}}>
                            Cabeçalho do Talão
                        </Typography>

                        <Stack spacing={2}>
                            <TextFieldKeyboard
                                value={firstLine}
                                onChange={onChangeFirst}
                                maxLength={MAX_HEADER_LEN}
                                showSymbols={false}
                                textFieldProps={{
                                    label: "Primeira Linha",
                                    fullWidth: true,
                                    required: true,
                                    helperText: firstErr
                                        ? `A primeira linha é obrigatória e deve ter entre 1 e ${MAX_HEADER_LEN} caracteres.`
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
                                    label: "Segunda Linha",
                                    fullWidth: true,
                                    helperText: secondErr
                                        ? `A segunda linha deve ter no máximo ${MAX_HEADER_LEN} caracteres.`
                                        : `${secondLine?.length || 0}/${MAX_HEADER_LEN}`,
                                    error: secondErr,
                                }}
                            />
                        </Stack>
                    </Box>

                    <LoadingButton
                        onClick={handleTestPrint}
                        loading={testing}
                        variant="outlined"
                        startIcon={<PrintRoundedIcon/>}
                        sx={{alignSelf: "flex-start"}}
                    >
                        Testar impressão
                    </LoadingButton>
                </Stack>
            )}
        </Box>
    );
}
