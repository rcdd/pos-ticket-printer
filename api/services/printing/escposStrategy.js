const {execFile} = require('child_process');

async function loadPrintersLib() {
    try {
        const mod = await import('@printers/printers');
        const candidate = mod?.default ?? mod;

        if (typeof candidate === 'function') {
            try {
                return new candidate();
            } catch {
            }
        }

        return candidate;
    } catch (e) {
        console.warn('[@printers/printers] import falhou:', e.message);
        return null;
    }
}

class EscposStrategy {
    async listPrinters() {
        const lib = await loadPrintersLib();
        if (lib?.getAllPrinters) {
            try {
                const printers = await lib.getAllPrinters();
                return Array.isArray(printers) ? printers : [];
            } catch {/* fallback CUPS */
            }
        }
        return listViaCUPS();
    }

    async printRawByName(printerName, buffer, jobName = 'POS Ticket') {
        const lib = await loadPrintersLib();
        if (lib?.getPrinterByName) {
            try {
                const p = await lib.getPrinterByName(printerName);
                if (!p) {
                    throw new Error(`Printer "${printerName}" not found`);
                }

                const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

                await p.printBytes(data, {jobName: jobName, simple: {paperSize: "COM10"}, waitForCompletion: true});

                return;
            } catch (e) {
            }
        }

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

/* ---------- Fallback via CUPS ---------- */

async function listViaCUPS() {
    return new Promise((resolve) => {
        execFile('lpstat', ['-p'], {encoding: 'utf8'}, (err, stdout) => {
            if (err) return resolve([]);

            const names = stdout
                .split('\n')
                .map(l => (l.split(" ")[1] || '').trim())
                .filter(Boolean);

            resolve(names.map(n => ({name: n, systemName: n})));
        });
    });
}

async function printViaCUPS(printerName, buffer, jobName) {
    return new Promise((resolve, reject) => {
        const cmd = '/usr/bin/lp'; // macOS
        const args = ['-d', String(printerName), '-o', 'raw', '-t', String(jobName)];
        const child = execFile(cmd, args, (e) => (e ? reject(e) : resolve()));
        child.stdin.on('error', reject);
        child.stdin.end(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
    });
}

module.exports = {EscposStrategy};
