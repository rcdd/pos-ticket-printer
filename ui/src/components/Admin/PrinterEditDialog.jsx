import React, {useEffect, useState} from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import WifiFindIcon from "@mui/icons-material/WifiFind";
import LanIcon from "@mui/icons-material/Lan";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";

import TextFieldKeyboard from "../Common/TextFieldKeyboard";
import PrintersService from "../../services/printers.service";
import PrinterService from "../../services/printer.service";
import {useToast} from "../Common/ToastProvider";
import TicketLayoutEditor, {DEFAULT_LAYOUT, ALL_TICKET_SECTIONS} from "./TicketLayoutEditor";

export const MAIN_PRINTER_ID = "main";

const COLUMN_OPTIONS = [48, 46, 44, 42, 40, 36, 34, 32, 30, 28];
const FEED_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12];

const emptyPrinter = (isMain) => ({
    name: "",
    connection: isMain
        ? {type: "system", systemName: "", host: "", port: 9100}
        : {type: "network", host: "", port: 9100, systemName: ""},
    profile: {
        // existing installs default to the historical trailing header
        headerPosition: isMain ? "trailing" : "top",
        cutMode: "command",
        feedLines: 4,
        columns: 48,
        codepage: "cp1252",
        fontSmall: false,
        drawerPin: 2,
        layout: {...DEFAULT_LAYOUT},
    },
    printType: "totals",
    openDrawer: false,
    // "main" (same as the main printer) exists only for additional printers
    header: {mode: isMain ? "custom" : "main", firstLine: "", secondLine: ""},
});

const MAX_HEADER_LEN = 40;

// What the API expects for the connection (drops the other type's fields)
const connectionPayload = (connection) => (connection.type === "network"
    ? {type: "network", host: (connection.host ?? "").trim(), port: Number(connection.port) || 9100}
    : {type: "system", systemName: connection.systemName ?? ""});

const SectionTitle = ({title, subtitle}) => (
    <Box>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Box>
);

// The same dialog for every printer. The main one adds what only the
// register's printer has (cash drawer, which tickets a direct sale prints)
// and the layout of every ticket type; additional printers only receive
// order tickets. "Imprimir exemplo"/"Testar gaveta" use the settings being
// edited, before saving.
export default function PrinterEditDialog({open, initial, isMain = false, onClose, onSave, saving}) {
    const {pushNetworkError, pushMessage, pushError} = useToast();
    const [draft, setDraft] = useState(emptyPrinter(isMain));
    const [discovering, setDiscovering] = useState(false);
    const [found, setFound] = useState(null); // null = not searched yet
    const [testingConn, setTestingConn] = useState(false);
    const [systemPrinters, setSystemPrinters] = useState(null);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [printingSample, setPrintingSample] = useState(null);

    useEffect(() => {
        if (!open) return;
        const base = emptyPrinter(isMain);
        setDraft(initial ? {
            ...base,
            ...initial,
            connection: {...base.connection, ...initial.connection},
            profile: {...base.profile, ...initial.profile, layout: {...base.profile.layout, ...initial.profile?.layout}},
            header: {...base.header, ...initial.header},
        } : base);
        setFound(null);
        setAdvancedOpen(false);
    }, [open, initial, isMain]);

    const conn = draft.connection;
    const setConn = (patch) => setDraft((d) => ({...d, connection: {...d.connection, ...patch}}));
    const setProfile = (patch) => setDraft((d) => ({...d, profile: {...d.profile, ...patch}}));
    const setHeader = (patch) => setDraft((d) => ({...d, header: {...d.header, ...patch}}));

    const payload = () => ({
        ...(isMain ? {printType: draft.printType, openDrawer: draft.openDrawer} : {name: draft.name.trim()}),
        header: draft.header,
        connection: connectionPayload(conn),
        profile: draft.profile,
    });

    const handleDiscover = async () => {
        setDiscovering(true);
        try {
            const {data} = await PrintersService.discover();
            setFound(data || []);
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível procurar impressoras"});
        } finally {
            setDiscovering(false);
        }
    };

    const handleTestConnection = async () => {
        setTestingConn(true);
        try {
            const {data} = await PrintersService.testConnection(conn.host, conn.port);
            if (data?.ok) {
                pushMessage("success", `Ligação a ${conn.host}:${conn.port} estabelecida.`);
            } else {
                pushError(
                    `A impressora ${conn.host}:${conn.port} não respondeu. Confirme o IP, a porta e se está ligada à mesma rede.`,
                    {title: "Sem ligação"},
                );
            }
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível testar a ligação"});
        } finally {
            setTestingConn(false);
        }
    };

    const handleSample = async (ticketType) => {
        setPrintingSample(ticketType);
        try {
            await PrintersService.printSample({
                printerId: isMain ? MAIN_PRINTER_ID : (initial?.id ?? "new"),
                ticketType,
                ...payload(),
            });
            pushMessage("success", ticketType === "drawer"
                ? "Comando de abertura enviado — a gaveta deve ter aberto."
                : "Exemplo enviado para a impressora.");
        } catch (error) {
            const data = error?.response?.data;
            pushError(data?.detail || data?.message || "A impressão falhou.", {
                title: ticketType === "drawer" ? "Não foi possível abrir a gaveta" : "O exemplo não foi impresso",
            });
        } finally {
            setPrintingSample(null);
        }
    };

    const loadSystemPrinters = async () => {
        if (systemPrinters !== null) return;
        try {
            const {data} = await PrinterService.getList();
            setSystemPrinters(data || []);
        } catch (error) {
            pushNetworkError(error, {title: "Não foi possível obter a lista de impressoras"});
        }
    };

    const connectionReady = conn.type === "network" ? Boolean(conn.host?.trim()) : Boolean(conn.systemName);
    const header = draft.header;
    const headerReady = header.mode !== "custom" || Boolean(header.firstLine?.trim() || header.secondLine?.trim());
    const canSave = connectionReady && headerReady && (isMain || draft.name.trim());

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" disableScrollLock>
            <DialogTitle>
                {isMain ? "Impressora principal" : initial ? `Editar "${initial.name}"` : "Adicionar impressora"}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    {isMain ? (
                        <Typography variant="body2" color="text.secondary">
                            A impressora da caixa: recibos, gaveta, resumo de sessão e tudo o que não estiver atribuído
                            a outra impressora.
                        </Typography>
                    ) : (
                        <TextFieldKeyboard
                            value={draft.name}
                            onChange={(val) => setDraft((d) => ({...d, name: val ?? ""}))}
                            maxLength={30}
                            showSymbols={false}
                            textFieldProps={{
                                label: "Nome",
                                fullWidth: true,
                                required: true,
                                helperText: "Livre — ex.: \"Cozinha\", \"Esplanada\", \"Impressora 2\".",
                            }}
                        />
                    )}

                    <SectionTitle title="Ligação"/>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={conn.type}
                        onChange={(e, value) => value && setConn({type: value})}
                        sx={{mt: "8px !important"}}
                    >
                        <ToggleButton value="system">Impressora do Windows</ToggleButton>
                        <ToggleButton value="network">Rede (Wi-Fi / cabo)</ToggleButton>
                    </ToggleButtonGroup>

                    {conn.type === "network" ? (
                        <Stack spacing={2}>
                            <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
                                <Box sx={{flex: 1}}>
                                    <TextFieldKeyboard
                                        value={conn.host ?? ""}
                                        onChange={(val) => setConn({host: (val ?? "").trim()})}
                                        maxLength={253}
                                        textFieldProps={{
                                            label: "IP ou nome na rede",
                                            fullWidth: true,
                                            required: true,
                                            placeholder: "192.168.1.50",
                                            helperText: "De preferência um IP fixo (reserva DHCP no router).",
                                        }}
                                    />
                                </Box>
                                <Box sx={{width: {xs: "100%", sm: 140}}}>
                                    <TextFieldKeyboard
                                        value={String(conn.port ?? 9100)}
                                        onChange={(val) => setConn({port: Number(String(val ?? "").replace(/\D/g, "")) || ""})}
                                        maxLength={5}
                                        textFieldProps={{label: "Porta", fullWidth: true, helperText: "Normalmente 9100"}}
                                    />
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                                <LoadingButton
                                    variant="outlined"
                                    startIcon={<WifiFindIcon/>}
                                    loading={discovering}
                                    onClick={handleDiscover}
                                >
                                    Procurar na rede
                                </LoadingButton>
                                <LoadingButton
                                    variant="outlined"
                                    startIcon={<LanIcon/>}
                                    loading={testingConn}
                                    disabled={!conn.host}
                                    onClick={handleTestConnection}
                                >
                                    Testar ligação
                                </LoadingButton>
                            </Stack>
                            {discovering && (
                                <Typography variant="body2" color="text.secondary">
                                    A procurar impressoras na rede local… (alguns segundos)
                                </Typography>
                            )}
                            {found !== null && !discovering && (
                                found.length === 0 ? (
                                    <Alert severity="info">
                                        Nenhuma impressora encontrada na porta {conn.port || 9100}. Confirme que está
                                        ligada à mesma rede que este computador.
                                    </Alert>
                                ) : (
                                    <Box sx={{border: 1, borderColor: "divider", borderRadius: 1}}>
                                        <Typography variant="caption" color="text.secondary"
                                                    sx={{px: 2, pt: 1, display: "block"}}>
                                            Encontradas — toque para usar:
                                        </Typography>
                                        <List dense>
                                            {found.map((f) => (
                                                <ListItemButton
                                                    key={`${f.host}:${f.port}`}
                                                    selected={f.host === conn.host}
                                                    onClick={() => setConn({host: f.host, port: f.port})}
                                                >
                                                    <ListItemText primary={f.host} secondary={f.hostname || null}/>
                                                </ListItemButton>
                                            ))}
                                        </List>
                                    </Box>
                                )
                            )}
                        </Stack>
                    ) : (
                        <FormControl fullWidth>
                            <InputLabel id="printer-system-name">Impressora do sistema</InputLabel>
                            <Select
                                MenuProps={{disableScrollLock: true}}
                                labelId="printer-system-name"
                                label="Impressora do sistema"
                                value={conn.systemName ?? ""}
                                onOpen={loadSystemPrinters}
                                onChange={(e) => setConn({systemName: e.target.value})}
                            >
                                {conn.systemName && !(systemPrinters ?? []).some((p) => p.systemName === conn.systemName) && (
                                    <MenuItem value={conn.systemName}>
                                        {conn.systemName}{systemPrinters !== null ? " (não encontrada)" : ""}
                                    </MenuItem>
                                )}
                                {systemPrinters === null && (
                                    <MenuItem value="__loading__" disabled>
                                        <CircularProgress size={16} sx={{mr: 1}}/> A procurar impressoras…
                                    </MenuItem>
                                )}
                                {(systemPrinters ?? []).map((p) => (
                                    <MenuItem key={p.systemName} value={p.systemName}>{p.name}</MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>Impressora instalada e partilhada no Windows.</FormHelperText>
                        </FormControl>
                    )}

                    {isMain && (
                        <>
                            <Divider/>
                            <SectionTitle title="Na caixa"/>
                            <FormControl fullWidth sx={{mt: "8px !important"}}>
                                <InputLabel id="main-print-type">Venda direta imprime</InputLabel>
                                <Select
                                    MenuProps={{disableScrollLock: true}}
                                    labelId="main-print-type"
                                    label="Venda direta imprime"
                                    value={draft.printType}
                                    onChange={(e) => setDraft((d) => ({...d, printType: e.target.value}))}
                                >
                                    <MenuItem value="totals">Resumo por totais</MenuItem>
                                    <MenuItem value="tickets">Bilhetes individuais</MenuItem>
                                    <MenuItem value="both">Resumo e bilhetes</MenuItem>
                                </Select>
                                <FormHelperText>
                                    Só o talão de conta, uma senha por produto, ou ambos.
                                </FormHelperText>
                            </FormControl>
                            <Stack direction={{xs: "column", sm: "row"}} spacing={2} alignItems={{sm: "center"}}>
                                <FormControlLabel
                                    sx={{flex: 1}}
                                    control={<Switch
                                        checked={Boolean(draft.openDrawer)}
                                        onChange={(e) => setDraft((d) => ({...d, openDrawer: e.target.checked}))}
                                    />}
                                    label="Abrir a gaveta de dinheiro ao imprimir"
                                />
                                <FormControl size="small" sx={{minWidth: 180}}>
                                    <InputLabel id="main-drawer-pin">Pino da gaveta</InputLabel>
                                    <Select
                                        MenuProps={{disableScrollLock: true}}
                                        labelId="main-drawer-pin"
                                        label="Pino da gaveta"
                                        value={draft.profile.drawerPin ?? 2}
                                        onChange={(e) => setProfile({drawerPin: Number(e.target.value)})}
                                    >
                                        <MenuItem value={2}>Pino 2 (mais comum)</MenuItem>
                                        <MenuItem value={5}>Pino 5</MenuItem>
                                    </Select>
                                </FormControl>
                                <LoadingButton
                                    variant="outlined"
                                    startIcon={<PointOfSaleIcon/>}
                                    loading={printingSample === "drawer"}
                                    disabled={!connectionReady || (printingSample !== null && printingSample !== "drawer")}
                                    onClick={() => handleSample("drawer")}
                                >
                                    Testar gaveta
                                </LoadingButton>
                            </Stack>
                        </>
                    )}

                    <Divider/>
                    <SectionTitle
                        title="Cabeçalho"
                        subtitle={isMain
                            ? "O que sai no topo dos talões da Principal (e das impressoras que usam o mesmo)."
                            : "O que sai no topo dos talões desta impressora."}
                    />
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={header.mode}
                        onChange={(e, value) => value && setHeader({mode: value})}
                        sx={{mt: "8px !important", flexWrap: "wrap"}}
                    >
                        {!isMain && <ToggleButton value="main">Igual à Principal</ToggleButton>}
                        <ToggleButton value="custom">Personalizado</ToggleButton>
                        <ToggleButton value="none">Sem cabeçalho</ToggleButton>
                    </ToggleButtonGroup>
                    {header.mode === "custom" && (
                        <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
                            <Box sx={{flex: 1}}>
                                <TextFieldKeyboard
                                    value={header.firstLine ?? ""}
                                    onChange={(val) => setHeader({firstLine: val ?? ""})}
                                    maxLength={MAX_HEADER_LEN}
                                    showSymbols={false}
                                    textFieldProps={{
                                        label: "Primeira linha",
                                        fullWidth: true,
                                        placeholder: isMain ? "Nome do evento" : "COZINHA",
                                        error: !headerReady,
                                        helperText: !headerReady
                                            ? "Escreva pelo menos uma linha."
                                            : `${(header.firstLine ?? "").length}/${MAX_HEADER_LEN}`,
                                    }}
                                />
                            </Box>
                            <Box sx={{flex: 1}}>
                                <TextFieldKeyboard
                                    value={header.secondLine ?? ""}
                                    onChange={(val) => setHeader({secondLine: val ?? ""})}
                                    maxLength={MAX_HEADER_LEN}
                                    showSymbols={false}
                                    textFieldProps={{
                                        label: "Segunda linha (opcional)",
                                        fullWidth: true,
                                        helperText: `${(header.secondLine ?? "").length}/${MAX_HEADER_LEN}`,
                                    }}
                                />
                            </Box>
                        </Stack>
                    )}
                    {header.mode === "none" && draft.profile.headerPosition === "trailing" && (
                        <Alert severity="info">
                            Sem cabeçalho e com "cabeçalho no fim, antes do corte" ligado: se a última linha
                            ficar cortada, aumente o "avanço antes do corte" nas definições avançadas.
                        </Alert>
                    )}

                    <Divider/>
                    <SectionTitle
                        title="Tamanho do texto nos talões"
                        subtitle={isMain
                            ? "A opção \"padrão\" é o tamanho típico. Se algum texto sair deformado, ajuste e confirme com \"Imprimir exemplo\"."
                            : "Esta impressora só recebe talões de pedido. Independente das outras impressoras."}
                    />
                    <TicketLayoutEditor
                        layout={draft.profile.layout}
                        onChange={(layout) => setProfile({layout})}
                        sections={isMain ? ALL_TICKET_SECTIONS : ["order"]}
                        onPrintSample={connectionReady ? handleSample : null}
                        printingSample={printingSample}
                    />

                    <Divider/>
                    <Box>
                        <Button size="small" onClick={() => setAdvancedOpen((v) => !v)}>
                            {advancedOpen ? "Esconder definições avançadas" : "Definições avançadas (corte, largura, caracteres)"}
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                            Configura-se uma vez, ao instalar a impressora.
                        </Typography>
                    </Box>
                    {advancedOpen && (
                        <Stack spacing={2}>
                            <FormControlLabel
                                control={<Switch
                                    checked={draft.profile.headerPosition === "trailing"}
                                    onChange={(e) => setProfile({headerPosition: e.target.checked ? "trailing" : "top"})}
                                />}
                                label={
                                    <Box>
                                        <Typography variant="subtitle2">
                                            Cabeçalho no fim, antes do corte (impressoras antigas)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Compensa a folga entre a cabeça e a guilhotina — o cabeçalho vira o topo do
                                            talão seguinte. Desligado: cabeçalho no topo.
                                        </Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                control={<Switch
                                    checked={draft.profile.cutMode === "auto"}
                                    onChange={(e) => setProfile({cutMode: e.target.checked ? "auto" : "command"})}
                                />}
                                label={
                                    <Box>
                                        <Typography variant="subtitle2">A impressora corta sozinha (auto-cut)</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Ligue se sair um corte a mais no fim de cada talão.
                                        </Typography>
                                    </Box>
                                }
                            />
                            <FormControlLabel
                                control={<Switch
                                    checked={Boolean(draft.profile.fontSmall)}
                                    onChange={(e) => setProfile({fontSmall: e.target.checked})}
                                />}
                                label={
                                    <Box>
                                        <Typography variant="subtitle2">Fonte pequena (Font B)</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Mais colunas por linha — útil em papel de 58 mm ou talões longos.
                                        </Typography>
                                    </Box>
                                }
                            />
                            {draft.profile.cutMode === "auto" && draft.profile.headerPosition === "trailing" && (
                                <Alert severity="warning">
                                    Combinação não recomendada: com auto-cut, desligue o "cabeçalho no fim" — senão o
                                    cabeçalho sai no fundo do próprio talão.
                                </Alert>
                            )}
                            <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", md: "1fr 1fr 1fr"}, gap: 2}}>
                                <FormControl>
                                    <InputLabel id="printer-columns">Largura (colunas)</InputLabel>
                                    <Select
                                        MenuProps={{disableScrollLock: true}}
                                        labelId="printer-columns"
                                        label="Largura (colunas)"
                                        value={draft.profile.columns}
                                        onChange={(e) => setProfile({columns: Number(e.target.value)})}
                                    >
                                        {COLUMN_OPTIONS.map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n} colunas{n === 48 ? " — 80 mm (padrão)" : n === 32 ? " — 58 mm" : ""}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    <FormHelperText>Se a linha separadora quebrar em duas, reduza.</FormHelperText>
                                </FormControl>
                                <FormControl>
                                    <InputLabel id="printer-feed">Avanço antes do corte</InputLabel>
                                    <Select
                                        MenuProps={{disableScrollLock: true}}
                                        labelId="printer-feed"
                                        label="Avanço antes do corte"
                                        value={draft.profile.feedLines}
                                        onChange={(e) => setProfile({feedLines: Number(e.target.value)})}
                                    >
                                        {FEED_OPTIONS.map((n) => <MenuItem key={n} value={n}>{n} linha(s)</MenuItem>)}
                                    </Select>
                                    <FormHelperText>Aumente se a última linha ficar cortada.</FormHelperText>
                                </FormControl>
                                <FormControl>
                                    <InputLabel id="printer-codepage">Codificação</InputLabel>
                                    <Select
                                        MenuProps={{disableScrollLock: true}}
                                        labelId="printer-codepage"
                                        label="Codificação"
                                        value={draft.profile.codepage}
                                        onChange={(e) => setProfile({codepage: e.target.value})}
                                    >
                                        <MenuItem value="cp1252">Ocidental — CP1252 (padrão)</MenuItem>
                                        <MenuItem value="cp858">PC858 (com €)</MenuItem>
                                        <MenuItem value="cp850">PC850</MenuItem>
                                    </Select>
                                    <FormHelperText>Mude se os acentos ou o € saírem trocados.</FormHelperText>
                                </FormControl>
                            </Box>
                        </Stack>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <LoadingButton
                    startIcon={<PrintRoundedIcon/>}
                    loading={printingSample === (isMain ? "test" : "order")}
                    disabled={!connectionReady || saving || printingSample !== null}
                    onClick={() => handleSample(isMain ? "test" : "order")}
                    sx={{mr: "auto"}}
                >
                    Imprimir teste
                </LoadingButton>
                <Button onClick={onClose} disabled={saving}>Cancelar</Button>
                <LoadingButton variant="contained" loading={saving} disabled={!canSave} onClick={() => onSave(payload())}>
                    Guardar
                </LoadingButton>
            </DialogActions>
        </Dialog>
    );
}
