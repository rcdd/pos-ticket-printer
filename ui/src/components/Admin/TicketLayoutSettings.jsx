import React, {useCallback, useEffect, useRef, useState} from "react";
import {
    Box,
    CircularProgress,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";

import OptionService from "../../services/option.service";
import PrinterService from "../../services/printer.service";
import {useToast} from "../Common/ToastProvider";

const SAVE_DEBOUNCE_MS = 500;

// Concrete size presets (width × height). Every element's default is the
// concrete equivalent of the historical output and gets a "— padrão" suffix,
// so the user always knows where the standard sits in the scale.
const SIZE_OPTIONS = [
    {value: "normal", label: "Normal (1×1)"},
    {value: "wide", label: "Largo (2×1)"},
    {value: "extraWide", label: "Extra largo (3×1)"},
    {value: "tall", label: "Alto (1×2)"},
    {value: "medium", label: "Médio (2×2)"},
    {value: "mediumTall", label: "Médio alto (2×3)"},
    {value: "big", label: "Grande (3×3)"},
    {value: "huge", label: "Extra grande (4×4)"},
];
const DEFAULT_LAYOUT = {
    itemName: "mediumTall",
    totalsItem: "extraWide",
    totalsTotal: "extraWide",
    orderLabel: "medium",
    orderValue: "big",
    orderItem: "wide",
    orderZone: "medium",
    sessionTotal: "wide",
};

// Approximate on-screen scale (width×height) of each choice.
const PREVIEW_SCALES = {
    normal: {sx: 1, sy: 1},
    wide: {sx: 2, sy: 1},
    extraWide: {sx: 3, sy: 1},
    tall: {sx: 1, sy: 2},
    medium: {sx: 2, sy: 2},
    mediumTall: {sx: 2, sy: 3},
    big: {sx: 3, sy: 3},
    huge: {sx: 4, sy: 4},
};
const scaleFor = (element, value) => PREVIEW_SCALES[value] ?? PREVIEW_SCALES.normal;

// One preview line, scaled horizontally/vertically like the printer would
function PreviewLine({scale = PREVIEW_SCALES.normal, bold = false, center = false, children}) {
    const base = 13;
    return (
        <Box sx={{
            height: `${base * 1.3 * scale.sy}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: center ? "center" : "flex-start",
            overflow: "hidden",
        }}>
            <Box component="span" sx={{
                fontFamily: "'Courier New', monospace",
                fontSize: `${base}px`,
                fontWeight: bold ? 700 : 400,
                whiteSpace: "nowrap",
                transform: `scale(${scale.sx}, ${scale.sy})`,
                transformOrigin: center ? "center center" : "left center",
            }}>
                {children}
            </Box>
        </Box>
    );
}

function TicketPreview({children}) {
    return (
        <Box sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1,
            p: 1.5,
            bgcolor: "background.default",
            minWidth: {xs: "100%", sm: 260},
            maxWidth: 320,
            overflow: "hidden",
        }}>
            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 0.5}}>
                Pré-visualização aproximada
            </Typography>
            {children}
        </Box>
    );
}

function SizeSelect({id, label, value, options, disabled, onChange, helper, defaultValue}) {
    return (
        <FormControl disabled={disabled} sx={{minWidth: 230}}>
            <InputLabel id={id}>{label}</InputLabel>
            <Select
                MenuProps={{disableScrollLock: true}}
                labelId={id}
                label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                        {o.value === defaultValue ? `${o.label} — padrão` : o.label}
                    </MenuItem>
                ))}
            </Select>
            {helper ? <FormHelperText>{helper}</FormHelperText> : null}
        </FormControl>
    );
}

function TicketLayoutSettings() {
    const {pushNetworkError, pushMessage} = useToast();

    const [loading, setLoading] = useState(true);
    const [layout, setLayout] = useState(DEFAULT_LAYOUT);
    const [printingSample, setPrintingSample] = useState(null); // ticketType being printed

    // optimistic saves: apply locally, debounce the POST, ignore stale
    // responses, reconcile from the server only on error (PrinterPage pattern)
    const saveTimer = useRef(null);
    const saveSeq = useRef(0);
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    useEffect(() => {
        let mounted = true;
        OptionService.getTicketLayout()
            .then(({data}) => {
                if (mounted && data) setLayout({...DEFAULT_LAYOUT, ...data});
            })
            .catch((error) => {
                if (mounted) pushNetworkError(error, {title: "Erro a carregar o layout dos talões"});
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
        // mount-only: the toast callbacks are stable (ToastProvider uses refs)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const persistLayout = useCallback(async () => {
        const seq = ++saveSeq.current;
        try {
            await OptionService.setTicketLayout(layoutRef.current);
            if (seq !== saveSeq.current) return; // a newer save is in flight
            pushMessage("success", "Layout dos talões guardado.");
        } catch (error) {
            if (seq !== saveSeq.current) return;
            pushNetworkError(error, {title: "Erro a guardar o layout dos talões"});
            try {
                const {data} = await OptionService.getTicketLayout();
                if (data) setLayout({...DEFAULT_LAYOUT, ...data});
            } catch {
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateLayout = useCallback((patch) => {
        setLayout((prev) => ({...prev, ...patch}));
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(persistLayout, SAVE_DEBOUNCE_MS);
    }, [persistLayout]);

    const handlePrintSample = async (ticketType) => {
        setPrintingSample(ticketType);
        try {
            await PrinterService.printLayoutSample(ticketType);
            pushMessage("success", "Exemplo enviado para a impressora.");
        } catch (error) {
            pushNetworkError(error, {title: "Erro a imprimir o exemplo"});
        } finally {
            setPrintingSample(null);
        }
    };

    if (loading) {
        return (
            <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20}/>
                <Typography variant="body2">A carregar layout dos talões…</Typography>
            </Stack>
        );
    }

    const sectionSx = {p: 3, border: (theme) => `1px solid ${theme.palette.divider}`};
    const sampleButton = (ticketType) => (
        <LoadingButton
            variant="outlined"
            startIcon={<PrintRoundedIcon/>}
            loading={printingSample === ticketType}
            disabled={printingSample !== null && printingSample !== ticketType}
            onClick={() => handlePrintSample(ticketType)}
            sx={{alignSelf: "flex-start"}}
        >
            Imprimir exemplo
        </LoadingButton>
    );

    return (
        <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
                Tamanhos de texto de cada tipo de talão. A opção marcada com "padrão" é o tamanho
                típico de cada elemento; se algum texto sair deformado ou demasiado grande nessa
                impressora, ajuste e confirme com "Imprimir exemplo".
            </Typography>

            <Paper elevation={0} sx={sectionSx}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Senha individual</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Talão impresso por cada produto (senha de cozinha/bar).
                </Typography>
                <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                    <Stack spacing={2}>
                        <SizeSelect
                            id="layout-item-name"
                            label="Nome do produto"
                            value={layout.itemName}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.itemName}
                            onChange={(v) => updateLayout({itemName: v})}
                        />
                        {sampleButton("item")}
                    </Stack>
                    <TicketPreview>
                        <PreviewLine bold center>Nome do Estabelecimento</PreviewLine>
                        <PreviewLine>____________________</PreviewLine>
                        <PreviewLine scale={scaleFor("itemName", layout.itemName)} bold>1 Bifana</PreviewLine>
                        <PreviewLine>____________________</PreviewLine>
                        <PreviewLine center>16/09/2026, 12:00:00</PreviewLine>
                    </TicketPreview>
                </Stack>
            </Paper>

            <Paper elevation={0} sx={sectionSx}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Talão de conta</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Talão com a lista de produtos e o total (pagamentos e vendas diretas).
                </Typography>
                <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                    <Stack spacing={2}>
                        <SizeSelect
                            id="layout-totals-item"
                            label="Linhas de produtos"
                            value={layout.totalsItem}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.totalsItem}
                            onChange={(v) => updateLayout({totalsItem: v})}
                        />
                        <SizeSelect
                            id="layout-totals-total"
                            label='Linha "Total"'
                            value={layout.totalsTotal}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.totalsTotal}
                            onChange={(v) => updateLayout({totalsTotal: v})}
                        />
                        {sampleButton("totals")}
                    </Stack>
                    <TicketPreview>
                        <PreviewLine>Pedido:</PreviewLine>
                        <PreviewLine scale={scaleFor("totalsItem", layout.totalsItem)} bold>2 Imperial</PreviewLine>
                        <PreviewLine scale={scaleFor("totalsItem", layout.totalsItem)} bold>1 Bifana</PreviewLine>
                        <PreviewLine scale={scaleFor("totalsTotal", layout.totalsTotal)} bold>Total: 5.90€</PreviewLine>
                    </TicketPreview>
                </Stack>
            </Paper>

            <Paper elevation={0} sx={sectionSx}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Pedido (terminais)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Talão de pedido enviado para a cozinha/bar pelos terminais (mesa ou balcão) e anulações.
                </Typography>
                <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                    <Stack spacing={2}>
                        <SizeSelect
                            id="layout-order-label"
                            label='Linha "MESA / PEDIDO"'
                            value={layout.orderLabel}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.orderLabel}
                            onChange={(v) => updateLayout({orderLabel: v})}
                        />
                        <SizeSelect
                            id="layout-order-value"
                            label="Nº da mesa / do pedido"
                            value={layout.orderValue}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.orderValue}
                            onChange={(v) => updateLayout({orderValue: v})}
                        />
                        <SizeSelect
                            id="layout-order-zone"
                            label="Linha de destino (secção)"
                            value={layout.orderZone}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.orderZone}
                            onChange={(v) => updateLayout({orderZone: v})}
                            helper="Impressa quando os talões são separados por secção (ex.: » COZINHA)."
                        />
                        <SizeSelect
                            id="layout-order-item"
                            label="Linhas de produtos"
                            value={layout.orderItem}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.orderItem}
                            onChange={(v) => updateLayout({orderItem: v})}
                        />
                        {sampleButton("order")}
                    </Stack>
                    <TicketPreview>
                        <PreviewLine scale={scaleFor("orderLabel", layout.orderLabel)} bold center>MESA</PreviewLine>
                        <PreviewLine scale={scaleFor("orderValue", layout.orderValue)} bold center>12A</PreviewLine>
                        <PreviewLine scale={scaleFor("orderZone", layout.orderZone)} bold center>» COZINHA</PreviewLine>
                        <PreviewLine>____________________</PreviewLine>
                        <PreviewLine scale={scaleFor("orderItem", layout.orderItem)} bold>2x Imperial</PreviewLine>
                        <PreviewLine scale={scaleFor("orderItem", layout.orderItem)} bold>1x Bifana</PreviewLine>
                        <PreviewLine center>Pedido #123 · Exemplo</PreviewLine>
                    </TicketPreview>
                </Stack>
            </Paper>

            <Paper elevation={0} sx={sectionSx}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Resumo de sessão</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Resumo impresso ao fechar a sessão de caixa.
                </Typography>
                <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                    <Stack spacing={2}>
                        <SizeSelect
                            id="layout-session-total"
                            label='Linha "Total" final'
                            value={layout.sessionTotal}
                            options={SIZE_OPTIONS}
                            defaultValue={DEFAULT_LAYOUT.sessionTotal}
                            onChange={(v) => updateLayout({sessionTotal: v})}
                        />
                        {sampleButton("session")}
                    </Stack>
                    <TicketPreview>
                        <PreviewLine>Fecho: 54.50€</PreviewLine>
                        <PreviewLine>____________________</PreviewLine>
                        <PreviewLine scale={scaleFor("sessionTotal", layout.sessionTotal)} bold>Total: 4.50€</PreviewLine>
                        <PreviewLine>____________________</PreviewLine>
                    </TicketPreview>
                </Stack>
            </Paper>
        </Stack>
    );
}

export default TicketLayoutSettings;
