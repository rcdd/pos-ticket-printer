import iconv from "iconv-lite";

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
    return iconv.encode((s ?? ''), 'cp1252');
}

export function textPrintLine(s) {
    return textPrint(s + '\n')
}

export function newLine() {
    return Buffer.from([0x0A]);
}

export function horizontalLine() {
    return textPrintLine('________________________________________________');
}

export function partialCut() {
    return Buffer.from([0x1D, 0x56, 0x00]);
}

export function fullCut() {
    return Buffer.from([0x1B, 0x6D, 0x00]);
}

export function escSelectCodepage() {
    return Buffer.from([0x1B, 0x74, 16]);
}

export function openCashDrawer() {
    return Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
}