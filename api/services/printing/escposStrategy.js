// EscposStrategy usando @point-of-sale/receipt-printer-encoder (100% JS, sem binários nativos)
// - Windows USB: envia RAW via print.exe
// - macOS USB: envia RAW via CUPS (lp)
// - Rede: podes chamar printRawByName com o teu próprio sender TCP, se precisares

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

/* ---------- OS helpers ---------- */

async function listViaWindows() {
    return new Promise((resolve) => {
        const ps = [
            'powershell',
            '-NoProfile',
            '-Command',
            'Get-Printer | Select-Object Name,DriverName,PortName,Default,Shared | ConvertTo-Json -Depth 2 -Compress'
        ];
        execFile(ps[0], ps.slice(1), { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const arr = JSON.parse(stdout);
                const list = Array.isArray(arr) ? arr : [arr];
                resolve(list.map(p => ({
                    name: p.Name,
                    systemName: p.Name,
                    driverName: p.DriverName,
                    portName: p.PortName,
                    isDefault: !!p.Default,
                    isShared: !!p.Shared,
                    nativePrinter: p
                })));
            } catch { resolve([]); }
        });
    });
}

async function listViaCUPS() {
    return new Promise((resolve) => {
        const cmd = '/usr/bin/lpstat';
        execFile(cmd, ['-p'], { encoding: 'utf8' }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const names = String(stdout)
                .split('\n')
                .map(l => (l.split(' ')[1] || '').trim())
                .filter(Boolean);
            resolve(names.map(n => ({ name: n, systemName: n })));
        });
    });
}

async function printViaWindows(printerName, buffer) {
    return new Promise((resolve, reject) => {
        try {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'posraw-'));
            const tmpFile = path.join(tmpDir, 'job.bin');
            fs.writeFileSync(tmpFile, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));

            const cmd = process.env.SystemRoot
                ? path.join(process.env.SystemRoot, 'System32', 'print.exe')
                : 'print';
            const args = ['/D:' + String(printerName), tmpFile];

            execFile(cmd, args, { windowsHide: true }, (e) => {
                try { fs.unlinkSync(tmpFile); fs.rmdirSync(tmpDir); } catch {}
                e ? reject(e) : resolve();
            });
        } catch (err) { reject(err); }
    });
}

async function printViaCUPS(printerName, buffer, jobName) {
    return new Promise((resolve, reject) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'posraw-'));
        const tmpFile = path.join(tmpDir, 'job.bin');
        fs.writeFileSync(tmpFile, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        const cmd = '/usr/bin/lp';
        const args = ['-d', String(printerName), '-o', 'raw', '-t', String(jobName ?? 'POS Ticket'), tmpFile];
        execFile(cmd, args, (e) => {
            try { fs.unlinkSync(tmpFile); fs.rmdirSync(tmpDir); } catch {}
            e ? reject(e) : resolve();
        });
    });
}

/* ---------- Encoder helpers ---------- */

function encodeReceipt(lines = [], {
    width = 48,
    cut = true,
    align = 'left',      // 'left' | 'center' | 'right'
    codepage = 'cp437',  // ver docs da lib para opções suportadas
} = {}) {
    const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        characterSet: codepage
    });

    encoder.initialize();
    if (align === 'center') encoder.align('center');
    if (align === 'right')  encoder.align('right');

    for (const line of lines) {
        if (line === '\n') { encoder.newline(); continue; }
        encoder.line(line);
    }

    if (cut) encoder.cutter();
    return Buffer.from(encoder.encode());
}

/* ---------- Strategy ---------- */

export class EscposStrategy {
    async listPrinters() {
        if (process.platform === 'win32') {
            const list = await listViaWindows();
            return Array.isArray(list) ? list : [];
        }
        return listViaCUPS();
    }

    async getPrinterDetails(printerName) {
        const list = await this.listPrinters();
        if (!Array.isArray(list)) return null;
        const target = String(printerName).toLowerCase();
        for (const printer of list) {
            const np = printer.nativePrinter ?? printer;
            const names = [np.name, np.systemName].map(n => n && String(n).toLowerCase());
            if (names.includes(target)) {
                return {
                    name: np.name ?? null,
                    systemName: np.systemName ?? null,
                    driverName: np.driverName || 'unknown',
                    uri: np.uri ?? null,
                    portName: np.portName ?? null,
                    description: np.description ?? null,
                    location: np.location ?? null,
                    isDefault: !!np.isDefault,
                    isShared: !!np.isShared,
                    state: np.state || 'unknown',
                    stateReasons: Array.isArray(np.stateReasons) ? np.stateReasons : [],
                };
            }
        }
        return null;
    }

    // Envia bytes RAW (ESC/POS) diretamente para a impressora
    async printRawByName(printerName, buffer, jobName = 'POS Ticket') {
        const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        if (process.platform === 'win32') {
            await printViaWindows(printerName, data);
            return;
        }
        if (process.platform === 'darwin') {
            await printViaCUPS(printerName, data, jobName);
            return;
        }
        throw new Error('Platform not supported');
    }

    // Constrói um recibo simples (linhas) e imprime
    async printLinesByName(printerName, lines, jobName = 'POS Ticket', opts = {}) {
        const payload = encodeReceipt(lines, opts);
        await this.printRawByName(printerName, payload, jobName);
    }

    // Helper simples: uma string multi-linha
    async printTextByName(printerName, text, jobName = 'POS Ticket', opts = {}) {
        const lines = String(text).split(/\r?\n/);
        await this.printLinesByName(printerName, lines, jobName, opts);
    }
}
