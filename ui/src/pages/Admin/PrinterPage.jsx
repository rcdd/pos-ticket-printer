import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Alert,
    Box,
    Divider,
    FormControl,
    FormControlLabel,
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
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

    // Printer list is loaded lazily (only when the select is opened): on
    // Windows it spawns a PowerShell `Get-Printer` that takes seconds, and it
    // was slowing down the whole settings page on every visit.
    const [printers, setPrinters] = useState(null); // null = not fetched yet
    const [printersLoading, setPrintersLoading] = useState(false);
    const [printer, setPrinter] = useState("");
    const [printType, setPrintType] = useState("totals");
    const [openDrawer, setOpenDrawer] = useState(false);

    // advanced panel: plain controlled show/hide (no MUI Collapse — it was a
    // red herring during the remount bug, but conditional render is simpler)
    const [advancedOpen, setAdvancedOpen] = useState(false);

    // print profile: independent hardware options (layout, cut, width, charset…)
    const [profile, setProfile] = useState({
        headerPosition: "trailing",
        cutMode: "command",
        feedLines: 4,
        paperWidth: 80,
        codepage: "cp1252",
        drawerPin: 2,
        fontSmall: false,
    });

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
                const [printerRes, typeRes, headersRes, openDrawerRes, profileRes] = await Promise.all([
                    OptionService.getPrinter(),
                    OptionService.getPrintType(),
                    OptionService.getHeaders(),
                    OptionService.getOpenDrawer(),
                    OptionService.getPrintProfile(),
                ]);

                if (!mounted) return;

                if (profileRes?.data) setProfile(profileRes.data);
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
        // mount-only: re-running this refetch swaps the controls for the
        // loading spinner and unmounts them mid-interaction
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadPrinters = useCallback(async () => {
        if (printers !== null || printersLoading) return;
        setPrintersLoading(true);
        try {
            const res = await PrinterService.getList();
            setPrinters(res.data || []);
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível obter a lista de impressoras"});
            // keep null so the next open retries
        } finally {
            setPrintersLoading(false);
        }
    }, [printers, printersLoading, pushNetworkError]);

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

    // Optimistic profile updates done right:
    // - the UI state is the source of truth and is NEVER overwritten by a
    //   success response (stale responses used to clobber newer clicks);
    // - rapid clicks are coalesced by a debounce into one save;
    // - a sequence guard ignores outcomes of superseded saves;
    // - on error we reconcile once with the server state.
    const profileRef = useRef(profile);
    profileRef.current = profile;
    const profileSaveSeq = useRef(0);
    const profileDebounce = useRef(null);

    const persistProfile = useCallback(async () => {
        const seq = ++profileSaveSeq.current;
        const snapshot = profileRef.current;
        try {
            await OptionService.setPrintProfile(snapshot);
            if (seq === profileSaveSeq.current) {
                pushMessage("success", "Perfil de impressão atualizado.");
            }
        } catch (error) {
            if (seq !== profileSaveSeq.current) return; // superseded — ignore
            pushNetworkError(error, {title: "Não foi possível guardar o perfil de impressão"});
            try {
                const {data} = await OptionService.getPrintProfile();
                if (data && seq === profileSaveSeq.current) setProfile(data);
            } catch {
            }
        }
    }, [pushMessage, pushNetworkError]);

    const updateProfile = useCallback((patch) => {
        setProfile((prev) => ({...prev, ...patch}));
        clearTimeout(profileDebounce.current);
        profileDebounce.current = setTimeout(persistProfile, 400);
    }, [persistProfile]);

    useEffect(() => () => clearTimeout(profileDebounce.current), []);

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

    const printerMenu = useMemo(() => {
        const list = printers ?? [];
        const items = [];
        // configured printer always renderable, even before the list loads
        // (also covers a saved printer that is currently offline/removed)
        if (printer && !list.some((p) => p.systemName === printer)) {
            items.push(
                <MenuItem key="__current__" value={printer}>
                    {printer}{printers !== null ? " (não encontrada)" : ""}
                </MenuItem>
            );
        }
        if (printersLoading) {
            items.push(
                <MenuItem key="__loading__" value="__loading__" disabled>
                    <CircularProgress size={16} sx={{mr: 1}}/> A procurar impressoras…
                </MenuItem>
            );
        }
        for (const p of list) {
            items.push(
                <MenuItem key={p.systemName} value={p.systemName}>
                    {p.name}
                </MenuItem>
            );
        }
        return items;
    }, [printers, printersLoading, printer]);

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
                                    MenuProps={{disableScrollLock: true}}
                                    labelId="printer-select-label"
                                    id="printer-select"
                                    label="Impressora"
                                    value={printer}
                                    onOpen={loadPrinters}
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
                                    MenuProps={{disableScrollLock: true}}
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

                            <Paper variant="outlined" sx={{borderRadius: 1}}>
                                <Box
                                    onClick={() => setAdvancedOpen((open) => !open)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        p: 2,
                                        cursor: "pointer",
                                        userSelect: "none",
                                        "&:hover": {bgcolor: "action.hover"},
                                    }}
                                >
                                    <TuneIcon fontSize="small" color="action"/>
                                    <Box sx={{flex: 1}}>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            Definições avançadas da impressora
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Configura-se uma vez, ao instalar a impressora. Valide sempre com
                                            "Testar impressão".
                                        </Typography>
                                    </Box>
                                    <ExpandMoreIcon sx={{
                                        transform: advancedOpen ? "rotate(180deg)" : "none",
                                        transition: "transform 150ms",
                                        color: "text.secondary",
                                    }}/>
                                </Box>
                                {advancedOpen && (
                                <Box sx={{px: 2, pb: 2}}>
                                    <Stack spacing={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={profile.headerPosition === "trailing"}
                                                    onChange={(e) => updateProfile({headerPosition: e.target.checked ? "trailing" : "top"})}
                                                    disabled={saving}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography variant="subtitle2">
                                                        Cabeçalho no fim, antes do corte (impressoras antigas)
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Compensa a folga entre a cabeça e a guilhotina — o cabeçalho
                                                        vira o topo do talão seguinte. Desligado: cabeçalho no topo.
                                                    </Typography>
                                                </Box>
                                            }
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={profile.cutMode === "auto"}
                                                    onChange={(e) => updateProfile({cutMode: e.target.checked ? "auto" : "command"})}
                                                    disabled={saving}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography variant="subtitle2">
                                                        A impressora corta sozinha (auto-cut)
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Ligue se sair um corte a mais no fim de cada talão.
                                                    </Typography>
                                                </Box>
                                            }
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={profile.fontSmall}
                                                    onChange={(e) => updateProfile({fontSmall: e.target.checked})}
                                                    disabled={saving}
                                                />
                                            }
                                            label={
                                                <Box>
                                                    <Typography variant="subtitle2">Fonte pequena (Font B)</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Mais colunas por linha — útil em papel de 58 mm ou talões longos.
                                                    </Typography>
                                                </Box>
                                            }
                                        />

                                        {profile.cutMode === "auto" && profile.headerPosition === "trailing" && (
                                            <Alert severity="warning">
                                                Combinação não recomendada: com auto-cut, desligue o "cabeçalho no fim"
                                                — senão o cabeçalho sai no fundo do próprio talão.
                                            </Alert>
                                        )}

                                        <Box sx={{
                                            display: "grid",
                                            gridTemplateColumns: {xs: "1fr", md: "1fr 1fr"},
                                            gap: 2,
                                        }}>
                                            <FormControl disabled={saving}>
                                                <InputLabel id="feed-lines-label">Avanço antes do corte</InputLabel>
                                                <Select
                                    MenuProps={{disableScrollLock: true}}
                                                    labelId="feed-lines-label"
                                                    label="Avanço antes do corte"
                                                    value={profile.feedLines}
                                                    onChange={(e) => updateProfile({feedLines: Number(e.target.value)})}
                                                >
                                                    {[0, 1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                                                        <MenuItem key={n} value={n}>{n} linha(s)</MenuItem>
                                                    ))}
                                                </Select>
                                                <FormHelperText>
                                                    Aumente se a última linha ficar cortada; diminua para poupar papel.
                                                </FormHelperText>
                                            </FormControl>

                                            <FormControl disabled={saving}>
                                                <InputLabel id="paper-width-label">Largura do papel</InputLabel>
                                                <Select
                                    MenuProps={{disableScrollLock: true}}
                                                    labelId="paper-width-label"
                                                    label="Largura do papel"
                                                    value={profile.paperWidth}
                                                    onChange={(e) => updateProfile({paperWidth: Number(e.target.value)})}
                                                >
                                                    <MenuItem value={80}>80 mm (48 colunas)</MenuItem>
                                                    <MenuItem value={58}>58 mm (32 colunas)</MenuItem>
                                                </Select>
                                                <FormHelperText>Largura do rolo de papel térmico.</FormHelperText>
                                            </FormControl>

                                            <FormControl disabled={saving}>
                                                <InputLabel id="codepage-label">Codificação de caracteres</InputLabel>
                                                <Select
                                    MenuProps={{disableScrollLock: true}}
                                                    labelId="codepage-label"
                                                    label="Codificação de caracteres"
                                                    value={profile.codepage}
                                                    onChange={(e) => updateProfile({codepage: e.target.value})}
                                                >
                                                    <MenuItem value="cp1252">Ocidental — CP1252 (padrão)</MenuItem>
                                                    <MenuItem value="cp858">PC858 (com €)</MenuItem>
                                                    <MenuItem value="cp850">PC850</MenuItem>
                                                </Select>
                                                <FormHelperText>
                                                    Mude se os acentos ou o símbolo € saírem trocados no papel.
                                                </FormHelperText>
                                            </FormControl>

                                            <FormControl disabled={saving}>
                                                <InputLabel id="drawer-pin-label">Pino da gaveta</InputLabel>
                                                <Select
                                    MenuProps={{disableScrollLock: true}}
                                                    labelId="drawer-pin-label"
                                                    label="Pino da gaveta"
                                                    value={profile.drawerPin}
                                                    onChange={(e) => updateProfile({drawerPin: Number(e.target.value)})}
                                                >
                                                    <MenuItem value={2}>Pino 2 (mais comum)</MenuItem>
                                                    <MenuItem value={5}>Pino 5</MenuItem>
                                                </Select>
                                                <FormHelperText>
                                                    Mude se a gaveta de dinheiro não abrir com o comando.
                                                </FormHelperText>
                                            </FormControl>
                                        </Box>
                                    </Stack>
                                </Box>
                                )}
                            </Paper>

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
