const iconv = require("iconv-lite");

function escInit() {
    return Buffer.from([0x1B, 0x40]);
}           // ESC @
function align(n) {
    return Buffer.from([0x1B, 0x61, n]);
}        // 0-left 1-center 2-right
function bold(on) {
    return Buffer.from([0x1B, 0x45, on ? 1 : 0]);
}

function boldMedium() {
    return Buffer.from([0x1B, 0x21, 0x20]);
}

function size(n) {
    return Buffer.from([0x1D, 0x21, n]);
}        // bit 0..3 (w,h)

function fontUnderline(on) {
    return Buffer.from([0x1B, 0x2D, on ? 1 : 0]);
}

function sizeWide() {
    return size(0x20);
}

function sizeNormal() {
    return size(0x00);
}

function textPrint(s) {
    return iconv.encode((s ?? ''), 'cp1252');
}

function textPrintLine(s) {
    return textPrint(s + '\n')
}

function newLine() {
    return Buffer.from([0x0A]);
}

function horizontalLine() {
    return textPrintLine('________________________________________________');
}

function partialCut() {
    return Buffer.from([0x1D, 0x56, 0x00]);
}

function fullCut() {
    return Buffer.from([0x1B, 0x6D, 0x00]);
}

function escSelectCodepage() {
    return Buffer.from([0x1B, 0x74, 16]);
}

function openCashDrawer() {
    return Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
}

module.exports = {
    escInit,
    align,
    bold,
    boldMedium,
    sizeWide,
    sizeNormal,
    fontUnderline,
    textPrint,
    textPrintLine,
    newLine,
    horizontalLine,
    partialCut,
    fullCut,
    escSelectCodepage,
    openCashDrawer
};