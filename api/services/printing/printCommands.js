import iconv from "iconv-lite";

// ---------------------------------------------------------------------------
// Printer settings (codepage, paper width, font, drawer pin) are applied via
// configurePrint() by printService right before a print job is assembled.
// Job assembly is fully synchronous, so a module-level setting is safe —
// there is no await between configurePrint() and the buffer being built.
// ---------------------------------------------------------------------------
export const CODEPAGES = Object.freeze({
    cp1252: {escT: 16, encoding: 'cp1252'}, // Windows-1252 (western, default)
    cp858: {escT: 19, encoding: 'cp858'},   // PC858 (PC850 + € at 0xD5)
    cp850: {escT: 2, encoding: 'cp850'},    // PC850 (no €)
});

// Characters per line vary per printer MODEL, not just paper width (plenty of
// 80mm printers are 42/44 columns) — so the column count is configured
// explicitly. Font B (small) fits ~4/3 of the Font A columns.
// GS ! byte per symmetric-ish size preset. Asymmetric multipliers (like the
// historical 3×-width) render inconsistently on cheap printers, so the
// configurable presets stick to safe values; 'legacy' keeps each element's
// historical byte sequence (the renderers emit it themselves).
export const SIZE_BYTES = Object.freeze({
    normal: 0x00,     // 1×1
    wide: 0x10,       // 2 wide × 1 tall
    tall: 0x01,       // 1 wide × 2 tall
    medium: 0x11,     // 2×2
    mediumTall: 0x12, // 2 wide × 3 tall
    big: 0x22,        // 3×3
    huge: 0x33,       // 4×4
});

// Per-element text sizes of the ticket layouts (see the renderers). Every
// default is 'legacy' so unconfigured installs print byte-identical tickets.
const ALL_SIZES = ['legacy', 'normal', 'wide', 'tall', 'medium', 'mediumTall', 'big', 'huge'];
export const TICKET_LAYOUT_OPTIONS = Object.freeze({
    itemName: ALL_SIZES,                                              // individual ticket: product name
    totalsItem: ALL_SIZES,                                            // totals receipt: item lines
    totalsTotal: ALL_SIZES,                                           // totals receipt: "Total:" line
    orderHighlight: ['legacy', 'medium', 'small'],                    // order ticket: MESA/PEDIDO block
    orderItem: ALL_SIZES.filter((s) => s !== 'huge'),                 // order ticket: item lines
    sessionTotal: ['legacy', 'normal', 'wide', 'tall', 'medium'],     // session summary: closing total
});

export const DEFAULT_TICKET_LAYOUT = Object.freeze(
    Object.fromEntries(Object.keys(TICKET_LAYOUT_OPTIONS).map((k) => [k, 'legacy']))
);

const DEFAULT_SETTINGS = Object.freeze({
    codepage: 'cp1252',
    columns: 48, // Font A characters per line
    fontSmall: false,
    drawerPin: 2,
    layout: DEFAULT_TICKET_LAYOUT,
});

let settings = {...DEFAULT_SETTINGS};

export function configurePrint(next = {}) {
    settings = {...DEFAULT_SETTINGS, ...next};
    if (!CODEPAGES[settings.codepage]) settings.codepage = DEFAULT_SETTINGS.codepage;
    const cols = Number(settings.columns);
    settings.columns = Number.isFinite(cols) ? Math.max(24, Math.min(64, Math.floor(cols))) : DEFAULT_SETTINGS.columns;
    const layout = {...DEFAULT_TICKET_LAYOUT};
    for (const [key, allowed] of Object.entries(TICKET_LAYOUT_OPTIONS)) {
        const value = next.layout?.[key];
        if (allowed.includes(value)) layout[key] = value;
    }
    settings.layout = layout;
}

export function resetPrintSettings() {
    settings = {...DEFAULT_SETTINGS};
}

// current size choice for a layout element — 'legacy' or a SIZE_BYTES key
export function layoutValue(element) {
    return settings.layout[element] ?? 'legacy';
}

const currentColumns = () =>
    settings.fontSmall ? Math.round(settings.columns * 4 / 3) : settings.columns;

export function escInit() {
    return Buffer.from([0x1B, 0x40]);
}           // ESC @
export function align(n) {
    return Buffer.from([0x1B, 0x61, n]);
}        // 0-left 1-center 2-right
export function bold(on) {
    return Buffer.from([0x1B, 0x45, on ? 1 : 0]);
}

export function boldMedium() {
    return Buffer.from([0x1B, 0x21, 0x20]);
}

export function size(n) {
    return Buffer.from([0x1D, 0x21, n]);
}        // bit 0..3 (w,h)

export function fontUnderline(on) {
    return Buffer.from([0x1B, 0x2D, on ? 1 : 0]);
}

export function sizeWide() {
    return size(0x20);
}

export function sizeNormal() {
    return size(0x00);
}

export function textPrint(s) {
    return iconv.encode((s ?? ''), CODEPAGES[settings.codepage].encoding);
}

export function textPrintLine(s) {
    return textPrint(s + '\n')
}

export function newLine() {
    return Buffer.from([0x0A]);
}

// n blank lines — used in standard cut mode to push the last printed line
// past the cutter blade (head↔cutter gap varies per printer model)
export function feed(n) {
    const count = Math.max(0, Math.min(24, Number(n) || 0));
    return Buffer.alloc(count, 0x0A);
}

export function horizontalLine() {
    return textPrintLine('_'.repeat(currentColumns()));
}

export function partialCut() {
    return Buffer.from([0x1D, 0x56, 0x00]);
}

export function fullCut() {
    return Buffer.from([0x1B, 0x6D, 0x00]);
}

// codepage table + font (ESC M: 0 = Font A, 1 = Font B/small) — sent right
// after ESC @ by every renderer's setup block
export function escSelectCodepage() {
    return Buffer.from([
        0x1B, 0x74, CODEPAGES[settings.codepage].escT,
        0x1B, 0x4D, settings.fontSmall ? 1 : 0,
    ]);
}

// drawer kick: pin 2 (most drawers) or pin 5
export function openCashDrawer() {
    return Buffer.from([0x1B, 0x70, settings.drawerPin === 5 ? 0x01 : 0x00, 0x19, 0xFA]);
}
