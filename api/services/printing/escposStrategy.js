import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let printersLibPromise = null;

async function resolvePrinters(mod) {
    const candidate = mod?.default ?? mod?.Printer ?? mod;
    return (typeof candidate === 'function') ? new candidate() : candidate;
}

async function tryImport(spec, label) {
    try {
        const m = await import(spec);
        const lib = await resolvePrinters(m);
        if (lib) {
            console.warn(`[@printers] usando ${label}`);
            return lib;
        }
    } catch {}
    return null;
}

async function loadPrintersLib() {
    if (!printersLibPromise) {
        printersLibPromise = (async () => {
            // 1) Binário específico (não explode se não existir)
            if (process.platform === 'darwin' && process.arch === 'arm64') {
                const mac = await tryImport('@printers/printers-darwin-arm64', 'darwin-arm64');
                if (mac) return mac;
            }
            if (process.platform === 'win32' && process.arch === 'x64') {
                const win = await tryImport('@printers/printers-win32-x64-msvc', 'win32-x64-msvc');
                if (win) return win;
            }

            // 2) Pacote genérico
            const generic = await tryImport('@printers/printers', 'genérico');
            if (generic) return generic;

            console.warn('[@printers] import falhou em todas as variantes');
            return null;
        })();
    }
    return printersLibPromise;
}

export class EscposStrategy {
    async listPrinters() {
        const lib = await loadPrintersLib();

        if (lib?.getAllPrinters) {
            try {
                const printers = await lib.getAllPrinters();
                return Array.isArray(printers) ? printers : [];
            } catch {}
        }

        if (process.platform === 'win32') {
            console.warn("[@printers] não disponível, fallback Windows (PowerShell)");
            const list = await listViaWindows();
            return Array.isArray(list) ? list : [];
        }
        console.warn("[@printers] não disponível, fallback CUPS ('lpstat')");
        return listViaCUPS();
    }

    async printRawByName(printerName, buffer, jobName = 'POS Ticket') {
        const lib = await loadPrintersLib();

        if (lib?.getPrinterByName) {
            try {
                const p = await lib.getPrinterByName(printerName);
                if (!p) throw new Error(`Printer "${printerName}" not found`);
                const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
                const printFn = p.printBytes ?? p.printRaw;
                if (typeof printFn !== 'function') throw new Error('Método de impressão não encontrado');

                await printFn.call(p, data, { jobName, simple: { paperSize: 'COM10' }, waitForCompletion: true });
                return;
            } catch {}
        }

        if (process.platform === 'win32') {
            console.warn("[@printers] não disponível, fallback Windows ('print.exe')");
            await printViaWindows(printerName, buffer, jobName);
            return;
        }
        console.warn("[@printers] não disponível, fallback CUPS ('lp')");
        await printViaCUPS(printerName, buffer, jobName);
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
}

/* ---------- Fallback Windows ---------- */
async function listViaWindows() {
    return new Promise((resolve) => {
        const ps = [
            'powershell','-NoProfile','-Command',
            'Get-Printer | Select-Object Name,DriverName,PortName,Default,Shared | ConvertTo-Json -Depth 2 -Compress'
        ];
        execFile(ps[0], ps.slice(1), { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            try {
                const arr = JSON.parse(stdout);
                const list = Array.isArray(arr) ? arr : [arr];
                resolve(list.map(p => ({
                    name: p.Name, systemName: p.Name,
                    driverName: p.DriverName, portName: p.PortName,
                    isDefault: !!p.Default, isShared: !!p.Shared,
                    nativePrinter: p
                })));
            } catch { resolve([]); }
        });
    });
}

async function printViaWindows(printerName, buffer, jobName) {
    return new Promise((resolve, reject) => {
        try {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'posraw-'));
            const tmpFile = path.join(tmpDir, 'job.bin');
            fs.writeFileSync(tmpFile, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));

            const cmd = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'print.exe') : 'print';
            const args = ['/D:' + String(printerName), tmpFile];

            execFile(cmd, args, { windowsHide: true }, (e) => {
                try { fs.unlinkSync(tmpFile); fs.rmdirSync(tmpDir); } catch {}
                if (e) return reject(e);
                resolve();
            });
        } catch (err) { reject(err); }
    });
}

/* ---------- Fallback via CUPS (macOS/Linux) ---------- */
async function listViaCUPS() {
    return new Promise((resolve) => {
        const cmd = '/usr/bin/lpstat';
        execFile(cmd, ['-p'], { encoding: 'utf8' }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const names = String(stdout).split('\n').map(l => (l.split(' ')[1] || '').trim()).filter(Boolean);
            resolve(names.map(n => ({ name: n, systemName: n })));
        });
    });
}

async function printViaCUPS(printerName, buffer, jobName) {
    return new Promise((resolve, reject) => {
        const cmd = '/usr/bin/lp';
        const args = ['-d', String(printerName), '-o', 'raw', '-t', String(jobName)];
        const child = execFile(cmd, args, (e) => (e ? reject(e) : resolve()));
        child.stdin.on('error', reject);
        child.stdin.end(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    });
}
