import React from "react";
import {
    Box,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";

// Concrete size presets (width × height). Every element's default is the
// concrete equivalent of the historical output and gets a "— padrão" suffix,
// so the user always knows where the standard sits in the scale.
export const SIZE_OPTIONS = [
    {value: "normal", label: "Normal (1×1)"},
    {value: "wide", label: "Largo (2×1)"},
    {value: "extraWide", label: "Extra largo (3×1)"},
    {value: "tall", label: "Alto (1×2)"},
    {value: "medium", label: "Médio (2×2)"},
    {value: "mediumTall", label: "Médio alto (2×3)"},
    {value: "big", label: "Grande (3×3)"},
    {value: "huge", label: "Extra grande (4×4)"},
];
export const DEFAULT_LAYOUT = {
    itemName: "mediumTall",
    totalsItem: "extraWide",
    totalsTotal: "extraWide",
    orderLabel: "medium",
    orderValue: "big",
    orderItem: "wide",
    orderNote: "normal",
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

// Ticket types an editor can show. The main printer prints all of them;
// an additional printer only ever receives order tickets.
export const ALL_TICKET_SECTIONS = ["item", "totals", "order", "session"];

// Controlled editor of the per-element text sizes, with an approximate live
// preview per ticket type. Saving is the caller's job (printer dialog);
// onPrintSample(ticketType) prints a sample with the settings being edited.
export default function TicketLayoutEditor({
    layout: value,
    onChange,
    sections = ALL_TICKET_SECTIONS,
    onPrintSample,
    printingSample = null,
    disabled = false,
}) {
    const layout = {...DEFAULT_LAYOUT, ...(value ?? {})};
    const updateLayout = (patch) => onChange({...layout, ...patch});

    const sectionSx = {p: 2, border: 1, borderColor: "divider", borderRadius: 1};
    const sampleButton = (ticketType) => onPrintSample ? (
        <LoadingButton
            variant="outlined"
            size="small"
            startIcon={<PrintRoundedIcon/>}
            loading={printingSample === ticketType}
            disabled={disabled || (printingSample !== null && printingSample !== ticketType)}
            onClick={() => onPrintSample(ticketType)}
            sx={{alignSelf: "flex-start"}}
        >
            Imprimir exemplo
        </LoadingButton>
    ) : null;
    const select = (key, id, label, helper) => (
        <SizeSelect
            id={id}
            label={label}
            value={layout[key]}
            options={SIZE_OPTIONS}
            defaultValue={DEFAULT_LAYOUT[key]}
            disabled={disabled}
            onChange={(v) => updateLayout({[key]: v})}
            helper={helper}
        />
    );

    return (
        <Stack spacing={2}>
            {sections.includes("item") && (
                <Box sx={sectionSx}>
                    <Typography variant="subtitle1" fontWeight={700}>Senha individual</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        Talão impresso por cada produto (senha de cozinha/bar).
                    </Typography>
                    <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                        <Stack spacing={2}>
                            {select("itemName", "layout-item-name", "Nome do produto")}
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
                </Box>
            )}

            {sections.includes("totals") && (
                <Box sx={sectionSx}>
                    <Typography variant="subtitle1" fontWeight={700}>Talão de conta</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        Talão com a lista de produtos e o total (pagamentos e vendas diretas).
                    </Typography>
                    <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                        <Stack spacing={2}>
                            {select("totalsItem", "layout-totals-item", "Linhas de produtos")}
                            {select("totalsTotal", "layout-totals-total", 'Linha "Total"')}
                            {sampleButton("totals")}
                        </Stack>
                        <TicketPreview>
                            <PreviewLine>Pedido:</PreviewLine>
                            <PreviewLine scale={scaleFor("totalsItem", layout.totalsItem)} bold>2 Imperial</PreviewLine>
                            <PreviewLine scale={scaleFor("totalsItem", layout.totalsItem)} bold>1 Bifana</PreviewLine>
                            <PreviewLine scale={scaleFor("totalsTotal", layout.totalsTotal)} bold>Total: 5.90€</PreviewLine>
                        </TicketPreview>
                    </Stack>
                </Box>
            )}

            {sections.includes("order") && (
                <Box sx={sectionSx}>
                    <Typography variant="subtitle1" fontWeight={700}>Pedido</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        Talão de pedido (terminais, ou venda direta enviada para outra impressora), anulações e
                        talão de levantamento.
                    </Typography>
                    <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                        <Stack spacing={2}>
                            {select("orderLabel", "layout-order-label", 'Linha "MESA / PEDIDO"')}
                            {select("orderValue", "layout-order-value", "Nº da mesa / do pedido")}
                            {select("orderZone", "layout-order-zone", "Linha de destino (zona)",
                                "Impressa quando os talões são separados por zona (ex.: » RESTAURANTE).")}
                            {select("orderItem", "layout-order-item", "Linhas de produtos")}
                            {select("orderNote", "layout-order-note", 'Observações ("Obs:")',
                                "Notas para a cozinha/bar — aumente para não passarem despercebidas.")}
                            {sampleButton("order")}
                        </Stack>
                        <TicketPreview>
                            <PreviewLine scale={scaleFor("orderLabel", layout.orderLabel)} bold center>MESA</PreviewLine>
                            <PreviewLine scale={scaleFor("orderValue", layout.orderValue)} bold center>12A</PreviewLine>
                            <PreviewLine scale={scaleFor("orderZone", layout.orderZone)} bold center>» COZINHA</PreviewLine>
                            <PreviewLine>____________________</PreviewLine>
                            <PreviewLine scale={scaleFor("orderItem", layout.orderItem)} bold>2x Imperial</PreviewLine>
                            <PreviewLine scale={scaleFor("orderItem", layout.orderItem)} bold>1x Bifana</PreviewLine>
                            <PreviewLine scale={scaleFor("orderNote", layout.orderNote)} bold>Obs: sem picante</PreviewLine>
                            <PreviewLine center>Pedido #123 · Exemplo</PreviewLine>
                        </TicketPreview>
                    </Stack>
                </Box>
            )}

            {sections.includes("session") && (
                <Box sx={sectionSx}>
                    <Typography variant="subtitle1" fontWeight={700}>Resumo de sessão</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        Resumo impresso ao fechar a sessão de caixa.
                    </Typography>
                    <Stack direction={{xs: "column", md: "row"}} spacing={3} alignItems={{md: "flex-start"}}>
                        <Stack spacing={2}>
                            {select("sessionTotal", "layout-session-total", 'Linha "Total" final')}
                            {sampleButton("session")}
                        </Stack>
                        <TicketPreview>
                            <PreviewLine>Fecho: 54.50€</PreviewLine>
                            <PreviewLine>____________________</PreviewLine>
                            <PreviewLine scale={scaleFor("sessionTotal", layout.sessionTotal)} bold>Total: 4.50€</PreviewLine>
                            <PreviewLine>____________________</PreviewLine>
                        </TicketPreview>
                    </Stack>
                </Box>
            )}
        </Stack>
    );
}
