import net from 'net';
import os from 'os';
import dns from 'dns/promises';

// ESC/POS printers on the LAN (Wi-Fi/Ethernet) accept raw jobs on a TCP port
// — 9100 ("JetDirect"/"RAW") on practically every thermal model. No driver,
// no Windows share: we open a socket, write the bytes and close it.
export const DEFAULT_NETWORK_PORT = 9100;

const CONNECT_TIMEOUT_MS = 4000;
const WRITE_TIMEOUT_MS = 10000;

export const normalizePort = (port) => {
    const parsed = Number(port);
    return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_NETWORK_PORT;
};

// host can be an IP or a name (router DNS / mDNS ".local") — the OS resolves it
export function sendRawTcp({host, port}, buffer) {
    return new Promise((resolve, reject) => {
        const target = String(host ?? '').trim();
        if (!target) {
            reject(new Error('Endereço da impressora de rede em falta.'));
            return;
        }
        const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        const socket = net.createConnection({host: target, port: normalizePort(port)});
        let settled = false;
        const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(connectTimer);
            socket.destroy();
            if (error) reject(error);
            else resolve();
        };

        const connectTimer = setTimeout(
            () => finish(new Error(`Sem resposta da impressora ${target}:${normalizePort(port)}.`)),
            CONNECT_TIMEOUT_MS,
        );

        socket.once('connect', () => {
            clearTimeout(connectTimer);
            // a printer that stops reading (paper out, cover open) must not
            // hang the request forever
            socket.setTimeout(WRITE_TIMEOUT_MS, () => finish(new Error(`A impressora ${target} deixou de responder.`)));
            socket.end(data);
        });
        // 'close' after end(): the bytes were flushed to the printer
        socket.once('close', (hadError) => {
            if (!hadError) finish();
        });
        socket.once('error', (error) => {
            finish(new Error(`Impressora ${target}:${normalizePort(port)} inacessível (${error.code || error.message}).`));
        });
    });
}

// Connection check only — opens and closes the socket, prints nothing.
export function probeTcp(host, port, timeoutMs = CONNECT_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const socket = net.createConnection({host: String(host), port: normalizePort(port)});
        const done = (ok) => {
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs, () => done(false));
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
    });
}

// IPv4 /24 networks of this machine's active interfaces — "the local network"
// as far as a festival setup is concerned (router + a few devices).
export function localSubnets(interfaces = os.networkInterfaces()) {
    const subnets = new Map();
    for (const addresses of Object.values(interfaces)) {
        for (const addr of addresses ?? []) {
            if (addr.family !== 'IPv4' && addr.family !== 4) continue;
            if (addr.internal) continue;
            if (addr.address.startsWith('169.254.')) continue; // no DHCP lease
            const prefix = addr.address.split('.').slice(0, 3).join('.');
            if (!subnets.has(prefix)) subnets.set(prefix, addr.address);
        }
    }
    return [...subnets.entries()].map(([prefix, ownAddress]) => ({prefix, ownAddress}));
}

const reverseName = async (ip) => {
    try {
        const names = await Promise.race([
            dns.reverse(ip),
            new Promise((resolve) => setTimeout(() => resolve([]), 1000)),
        ]);
        return names?.[0] ?? null;
    } catch {
        return null;
    }
};

// "Procurar impressoras": every host of the local /24 networks with the raw
// printing port open. Only a TCP connect — nothing is sent, so other devices
// (or non-ESC/POS printers that would print raw bytes as text) are unaffected.
export async function discoverNetworkPrinters({
    port = DEFAULT_NETWORK_PORT,
    timeoutMs = 700,
    concurrency = 64,
    subnets = localSubnets(),
} = {}) {
    const candidates = [];
    for (const {prefix, ownAddress} of subnets) {
        for (let i = 1; i < 255; i += 1) {
            const ip = `${prefix}.${i}`;
            if (ip !== ownAddress) candidates.push(ip);
        }
    }

    const found = [];
    let next = 0;
    const worker = async () => {
        while (next < candidates.length) {
            const ip = candidates[next];
            next += 1;
            if (await probeTcp(ip, port, timeoutMs)) found.push(ip);
        }
    };
    await Promise.all(Array.from({length: Math.min(concurrency, candidates.length)}, worker));

    const sorted = found.sort((a, b) => Number(a.split('.')[3]) - Number(b.split('.')[3]));
    return Promise.all(sorted.map(async (host) => ({
        host,
        port: normalizePort(port),
        hostname: await reverseName(host),
    })));
}
