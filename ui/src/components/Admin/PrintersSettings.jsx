import React, {useCallback, useEffect, useState} from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import AddIcon from "@mui/icons-material/Add";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import PrintersService from "../../services/printers.service";
import ZoneService from "../../services/zone.service";
import {useToast} from "../Common/ToastProvider";
import PrinterEditDialog, {MAIN_PRINTER_ID} from "./PrinterEditDialog";

const PRINT_TYPE_LABELS = {totals: "resumo por totais", tickets: "bilhetes individuais", both: "resumo e bilhetes"};

const HEADER_DETAILS = {
    custom: (header) => `cabeçalho: "${[header.firstLine, header.secondLine].filter(Boolean).join(" / ")}"`,
    none: () => "sem cabeçalho",
};

const describeConnection = (connection) => {
    if (connection?.type === "network") return `Rede · ${connection.host}:${connection.port}`;
    return connection?.systemName ? `Windows · ${connection.systemName}` : "Não configurada";
};

const paperSx = {p: 3, border: (theme) => `1px solid ${theme.palette.divider}`};

// One printer card — the same for the main and the additional printers.
function PrinterCard({printer, details, isMain, testing, busy, onTest, onEdit, onRemove}) {
    const configured = isMain
        ? (printer.connection?.type === "network" ? Boolean(printer.connection.host) : Boolean(printer.connection?.systemName))
        : true;
    return (
        <Paper variant="outlined" sx={{p: 2}}>
            <Stack direction={{xs: "column", md: "row"}} spacing={1.5} alignItems={{md: "center"}}>
                <Box sx={{flex: 1}}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={700}>{printer.name}</Typography>
                        {isMain && <Chip label="Caixa" size="small" variant="outlined"/>}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {describeConnection(printer.connection)}
                        {configured && ` · ${printer.profile?.columns} colunas`}
                        {details ? ` · ${details}` : ""}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <LoadingButton
                        size="small"
                        variant="outlined"
                        startIcon={<PrintRoundedIcon/>}
                        loading={testing}
                        disabled={!configured}
                        onClick={onTest}
                    >
                        Imprimir teste
                    </LoadingButton>
                    <Button size="small" variant={configured ? "text" : "contained"} startIcon={<EditIcon/>}
                            disabled={busy} onClick={onEdit}>
                        {configured ? "Editar" : "Configurar"}
                    </Button>
                    {onRemove && (
                        <Button size="small" color="error" startIcon={<DeleteOutlineIcon/>} disabled={busy}
                                onClick={onRemove}>
                            Remover
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Paper>
    );
}

// Configurações → Impressoras: the ticket header, every printer (main and
// additional, edited through the same dialog) and — once there is more than
// one printer — the multi-printer switch and where each zone prints.
// Turning the switch off sends everything to the main printer but keeps the
// whole setup for next time.
export default function PrintersSettings() {
    const {pushNetworkError, pushMessage, pushError} = useToast();
    const [config, setConfig] = useState(null);
    const [zones, setZones] = useState([]);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null); // null | {printer?, isMain?}
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState(null);
    const [removing, setRemoving] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [configRes, zonesRes] = await Promise.all([
                    PrintersService.getConfig(),
                    ZoneService.getAll(),
                ]);
                if (!mounted) return;
                setConfig(configRes.data);
                setZones((zonesRes.data || []).sort((a, b) => a.position - b.position));
            } catch (error) {
                if (mounted) pushNetworkError(error, {title: "Não foi possível carregar a configuração das impressoras"});
            }
        })();
        return () => {
            mounted = false;
        };
        // mount-only: refetching would swap the controls for the spinner
        // mid-interaction (the old PrinterPage remount bug)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = useCallback(async (request, {title, success} = {}) => {
        setBusy(true);
        try {
            const {data} = await request();
            setConfig(data);
            if (success) pushMessage("success", success);
            return true;
        } catch (error) {
            pushNetworkError(error, {title});
            return false;
        } finally {
            setBusy(false);
        }
    }, [pushMessage, pushNetworkError]);

    const handleToggle = (event) => {
        const enabled = event.target.checked;
        run(() => PrintersService.setEnabled(enabled), {
            title: "Não foi possível alterar o modo de impressão",
            success: enabled ? "Várias impressoras ativadas." : "Tudo volta a imprimir na impressora principal.",
        });
    };

    const handleRoute = (zoneId, printerId) => {
        const routes = {...(config?.routes ?? {})};
        if (printerId === MAIN_PRINTER_ID) delete routes[zoneId];
        else routes[zoneId] = printerId;
        run(() => PrintersService.setRoutes(routes), {title: "Não foi possível alterar o encaminhamento"});
    };

    const handleSave = async (payload) => {
        setSaving(true);
        const {isMain, printer} = editing ?? {};
        const ok = await run(
            () => {
                if (isMain) return PrintersService.updateMain(payload);
                return printer?.id ? PrintersService.update(printer.id, payload) : PrintersService.create(payload);
            },
            {
                title: "Não foi possível guardar a impressora",
                success: isMain || printer?.id ? "Impressora atualizada." : "Impressora adicionada.",
            },
        );
        setSaving(false);
        if (ok) setEditing(null);
    };

    const handleTest = async (printer) => {
        setTestingId(printer.id);
        try {
            await PrintersService.testPrint(printer.id);
            pushMessage("success", `Talão de teste enviado para "${printer.name}".`);
        } catch (error) {
            const data = error?.response?.data;
            pushError(data?.detail || data?.message || "A impressão de teste falhou.", {
                title: `"${printer.name}" não imprimiu`,
            });
        } finally {
            setTestingId(null);
        }
    };

    const handleRemove = async () => {
        const printer = removing;
        const ok = await run(() => PrintersService.remove(printer.id), {
            title: "Não foi possível remover a impressora",
            success: `"${printer.name}" removida — as zonas dela voltam à Principal.`,
        });
        if (ok) setRemoving(null);
    };

    if (!config) {
        return (
            <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={20}/>
                <Typography variant="body2">A carregar…</Typography>
            </Stack>
        );
    }

    const main = config.main;
    const printers = config.printers ?? [];
    const routedCount = Object.keys(config.routes ?? {}).length;
    const showRouting = printers.length > 0 || config.enabled;

    return (
        <Stack spacing={3}>
            <Paper elevation={0} sx={paperSx}>
                <Stack spacing={2}>
                    <Stack direction={{xs: "column", sm: "row"}} justifyContent="space-between" spacing={2}
                           alignItems={{sm: "flex-start"}}>
                        <Box>
                            <Typography variant="h5" fontWeight={700}>Impressoras</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Todas configuram-se da mesma forma: ligação, cabeçalho, tamanho do texto e definições
                                avançadas.
                                Uma impressora adicional serve para enviar os talões de uma zona para outro sítio
                                (ex.: a comida para a cozinha).
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon/>}
                            disabled={busy || printers.length >= (config.maxPrinters ?? 5)}
                            onClick={() => setEditing({})}
                            sx={{flexShrink: 0}}
                        >
                            Adicionar impressora
                        </Button>
                    </Stack>

                    <PrinterCard
                        printer={main}
                        isMain
                        details={[
                            `caixa: ${PRINT_TYPE_LABELS[main.printType] ?? main.printType}${main.openDrawer ? ", abre a gaveta" : ""}`,
                            HEADER_DETAILS[main.header?.mode]?.(main.header),
                        ].filter(Boolean).join(" · ")}
                        testing={testingId === main.id}
                        busy={busy}
                        onTest={() => handleTest(main)}
                        onEdit={() => setEditing({printer: main, isMain: true})}
                    />
                    {printers.map((printer) => (
                        <PrinterCard
                            key={printer.id}
                            printer={printer}
                            details={HEADER_DETAILS[printer.header?.mode]?.(printer.header)}
                            testing={testingId === printer.id}
                            busy={busy}
                            onTest={() => handleTest(printer)}
                            onEdit={() => setEditing({printer})}
                            onRemove={() => setRemoving(printer)}
                        />
                    ))}
                </Stack>
            </Paper>

            {showRouting && (
                <Paper elevation={0} sx={paperSx}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6" fontWeight={700}>Várias impressoras</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Vale para os pedidos dos terminais (incluindo anulações e mudanças de mesa) e para as
                                vendas diretas na caixa: os artigos de uma zona atribuída a outra impressora saem lá
                                como pedido numerado, e o cliente recebe na caixa um talão com o mesmo número para
                                levantar.
                            </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Switch checked={Boolean(config.enabled)} onChange={handleToggle} disabled={busy}/>
                            <Box>
                                <Typography variant="subtitle2">
                                    {config.enabled
                                        ? "Ativo — cada zona imprime na impressora indicada abaixo"
                                        : "Desligado — tudo imprime na impressora principal"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Ao desligar, as impressoras e o encaminhamento ficam guardados para a próxima vez.
                                </Typography>
                            </Box>
                        </Stack>
                        {config.enabled && routedCount === 0 && (
                            <Alert severity="warning">
                                Nenhuma zona está atribuída a outra impressora — por agora tudo continua a sair na
                                Principal.
                            </Alert>
                        )}

                        <Typography variant="subtitle1" fontWeight={700}>Onde imprime cada zona</Typography>
                        {zones.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">Não existem zonas.</Typography>
                        ) : (
                            // compact table: zone and its printer side by side, so each
                            // row reads "Restaurante → Cozinha"
                            <TableContainer component={Paper} variant="outlined"
                                            sx={{maxWidth: 640, opacity: config.enabled ? 1 : 0.6}}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{bgcolor: "action.hover"}}>
                                            <TableCell sx={{fontWeight: 700}}>Zona</TableCell>
                                            <TableCell sx={{width: 32, px: 0}}/>
                                            <TableCell sx={{fontWeight: 700}}>Imprime em</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {zones.map((zone) => {
                                            const target = config.routes?.[zone.id] ?? MAIN_PRINTER_ID;
                                            return (
                                                <TableRow key={zone.id}
                                                          sx={{"&:nth-of-type(even)": {bgcolor: "action.hover"}, "&:last-child td": {border: 0}}}>
                                                    <TableCell sx={{fontWeight: 600}}>{zone.name}</TableCell>
                                                    <TableCell sx={{px: 0, color: "text.secondary"}}>
                                                        <ArrowForwardIcon fontSize="small" sx={{display: "block"}}/>
                                                    </TableCell>
                                                    <TableCell sx={{py: 1}}>
                                                        <FormControl size="small" fullWidth disabled={busy}>
                                                            <Select
                                                                MenuProps={{disableScrollLock: true}}
                                                                value={target}
                                                                onChange={(e) => handleRoute(zone.id, e.target.value)}
                                                                sx={{
                                                                    bgcolor: "background.paper",
                                                                    fontWeight: target === MAIN_PRINTER_ID ? 700 : 400,
                                                                }}
                                                            >
                                                                <MenuItem value={MAIN_PRINTER_ID}>{main.name}</MenuItem>
                                                                {printers.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                                                            </Select>
                                                        </FormControl>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                        <Alert severity="info">
                            Se uma impressora adicional falhar (desligada, sem papel, sem rede), o talão sai na
                            Principal com o aviso "IMPRESSORA … FALHOU" — nenhum pedido se perde.
                        </Alert>
                    </Stack>
                </Paper>
            )}

            <PrinterEditDialog
                open={editing !== null}
                initial={editing?.printer ?? null}
                isMain={Boolean(editing?.isMain)}
                saving={saving}
                onClose={() => setEditing(null)}
                onSave={handleSave}
            />

            <Dialog open={removing !== null} onClose={() => setRemoving(null)} disableScrollLock>
                <DialogTitle>Remover impressora</DialogTitle>
                <DialogContent>
                    <Typography>
                        Remover "{removing?.name}"? As zonas atribuídas a ela voltam a imprimir na Principal.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRemoving(null)}>Cancelar</Button>
                    <LoadingButton color="error" variant="contained" loading={busy} onClick={handleRemove}>
                        Remover
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
