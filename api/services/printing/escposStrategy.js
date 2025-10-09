import {execFile} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Printer} from '@printers/printers';

/* -------- Optional backend (@printers/printers) -------- */
let printersLibPromise = null;

async function loadPrintersLib() {
    if (!printersLibPromise) {
        printersLibPromise = (async () => {
            try {
                const mod = await import('@printers/printers');
                const candidate = mod?.default ?? mod;
                return typeof candidate === 'function' ? new candidate() : candidate;
            } catch (e) {
                console.warn('a tentar import direto @printers/printers...');
                try {
                    return Printer
                } catch (e) {
                    console.warn('[@printers/printers] import direto falhou:', e?.message || e);

                }
                console.warn('[@printers/printers] import falhou:', e?.message || e);
                return null;
            }
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
            } catch { /* ignore and fallback */
            }
        }

        if (process.platform === 'win32') {
            console.warn("[@printers/printers] não disponível, usando fallback Windows via PowerShell");
            const list = await listViaWindows();
            return Array.isArray(list) ? list : [];
        }
        console.warn("[@printers/printers] não disponível, usando fallback CUPS via 'lpstat'");
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
                if (typeof printFn !== 'function') throw new Error('Método de impressão não encontrado no objeto da impressora');

                await printFn.call(p, data, {jobName, simple: {paperSize: 'COM10'}, waitForCompletion: true});
                return;
            } catch { /* ignore and fallback */
            }
        }

        if (process.platform === 'win32') {
            console.warn("[@printers/printers] não disponível, usando fallback Windows via 'print.exe'");
            await printViaWindows(printerName, buffer, jobName);
            return;
        }
        console.warn("[@printers/printers] não disponível, usando fallback CUPS via 'lp'");
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
            'powershell',
            '-NoProfile',
            '-Command',
            'Get-Printer | Select-Object Name,DriverName,PortName,Default,Shared | ConvertTo-Json -Depth 2 -Compress'
        ];
        execFile(ps[0], ps.slice(1), {encoding: 'utf8', windowsHide: true}, (err, stdout) => {
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
            } catch {
                resolve([]);
            }
        });
    });
}

async function printViaWindows(printerName, buffer, jobName) {
    return new Promise((resolve, reject) => {
        try {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'posraw-'));
            const tmpFile = path.join(tmpDir, 'job.bin');
            fs.writeFileSync(tmpFile, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));

            const cmd = process.env.SystemRoot
                ? path.join(process.env.SystemRoot, 'System32', 'print.exe')
                : 'print';
            const args = ['/D:' + String(printerName), tmpFile];

            execFile(cmd, args, {windowsHide: true}, (e) => {
                try {
                    fs.unlinkSync(tmpFile);
                    fs.rmdirSync(tmpDir);
                } catch { /* ignore */
                }
                if (e) return reject(e);
                resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

/* ---------- Fallback via CUPS (macOS/Linux) ---------- */

async function listViaCUPS() {
    return new Promise((resolve) => {
        const cmd = '/usr/bin/lpstat';
        execFile(cmd, ['-p'], {encoding: 'utf8'}, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const names = String(stdout)
                .split('\n')
                .map(l => (l.split(' ')[1] || '').trim())
                .filter(Boolean);
            resolve(names.map(n => ({name: n, systemName: n})));
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
