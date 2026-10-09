import {normalizeTicketLayout} from './printCommands.js';
import {normalizePort} from './networkPrinter.js';

// Additional printers (besides the main one, which keeps its historical
// options). Pure validation/normalization — no DB — so it is unit-testable.
// Shape: {id, name, connection, profile}
//   connection: {type: 'network', host, port} | {type: 'system', systemName}
//   profile: same fields as the main print profile, minus the drawer (the
//   cash drawer only ever hangs off the main printer), plus its own layout.
export const MAX_EXTRA_PRINTERS = 5;
const MAX_NAME_LEN = 30;

export const DEFAULT_EXTRA_PROFILE = Object.freeze({
    headerPosition: 'top',
    cutMode: 'command',
    feedLines: 4,
    columns: 48,
    codepage: 'cp1252',
    fontSmall: false,
});

const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;

const fail = (message) => ({error: message});

// {type: 'network', host, port} | {type: 'system', systemName}
export function validateConnection(conn = {}) {
    if (conn.type === 'network') {
        const host = String(conn.host ?? '').trim();
        if (!HOST_PATTERN.test(host)) return fail('Indique o IP ou o nome da impressora na rede.');
        const port = Number(conn.port ?? 9100);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return fail('Porta inválida.');
        return {connection: {type: 'network', host, port: normalizePort(port)}};
    }
    if (conn.type === 'system') {
        const systemName = String(conn.systemName ?? '').trim();
        if (!systemName) return fail('Escolha a impressora do sistema.');
        return {connection: {type: 'system', systemName}};
    }
    return fail('Tipo de ligação inválido.');
}

// hardware profile + ticket layout; withDrawer adds the cash-drawer pin
// (main printer only)
export function validateProfile(p = {}, {defaults = DEFAULT_EXTRA_PROFILE, withDrawer = false} = {}) {
    const feedLines = Number(p.feedLines ?? defaults.feedLines);
    if (!Number.isInteger(feedLines) || feedLines < 0 || feedLines > 12) {
        return fail('O avanço antes do corte tem de estar entre 0 e 12 linhas.');
    }
    const columns = Number(p.columns ?? defaults.columns);
    if (!Number.isInteger(columns) || columns < 24 || columns > 64) {
        return fail('As colunas por linha têm de estar entre 24 e 64.');
    }
    const codepage = p.codepage ?? defaults.codepage;
    if (!['cp1252', 'cp858', 'cp850'].includes(codepage)) return fail('Codepage inválido.');

    const headerPosition = p.headerPosition ?? defaults.headerPosition;
    const profile = {
        headerPosition: headerPosition === 'trailing' ? 'trailing' : 'top',
        cutMode: p.cutMode === 'auto' ? 'auto' : 'command',
        feedLines,
        columns,
        codepage,
        fontSmall: p.fontSmall === true,
        layout: normalizeTicketLayout(p.layout ?? {}),
    };
    if (withDrawer) {
        const drawerPin = Number(p.drawerPin ?? 2);
        if (![2, 5].includes(drawerPin)) return fail('O pino da gaveta tem de ser 2 ou 5.');
        profile.drawerPin = drawerPin;
    }
    return {profile};
}

export const MAX_HEADER_LEN = 40;
export const HEADER_MODES = ['main', 'custom', 'none'];

// Ticket header of an additional printer: the main printer's ('main',
// default), its own lines ('custom' — e.g. "COZINHA") or none at all.
export function validateHeader(h = {}) {
    const mode = h?.mode ?? 'main';
    if (!HEADER_MODES.includes(mode)) return fail('Tipo de cabeçalho inválido.');
    const firstLine = String(h?.firstLine ?? '').trim();
    const secondLine = String(h?.secondLine ?? '').trim();
    if (firstLine.length > MAX_HEADER_LEN || secondLine.length > MAX_HEADER_LEN) {
        return fail(`As linhas do cabeçalho têm no máximo ${MAX_HEADER_LEN} caracteres.`);
    }
    if (mode === 'custom' && !firstLine && !secondLine) {
        return fail('Escreva pelo menos uma linha do cabeçalho (ou escolha "Sem cabeçalho").');
    }
    // the lines are kept in every mode, so switching back restores them
    return {header: {mode, firstLine, secondLine}};
}

// The header lines a printer actually prints, given the main printer's.
export function resolveHeader(header, mainHeaders) {
    if (header?.mode === 'custom') {
        return {firstLine: header.firstLine || null, secondLine: header.secondLine || null};
    }
    if (header?.mode === 'none') return {firstLine: null, secondLine: null};
    return mainHeaders;
}

export function validateExtraPrinter(body = {}, {id} = {}) {
    const name = String(body.name ?? '').trim();
    if (!name) return fail('O nome da impressora é obrigatório.');
    if (name.length > MAX_NAME_LEN) return fail(`O nome tem no máximo ${MAX_NAME_LEN} caracteres.`);

    const {connection, error: connError} = validateConnection(body.connection);
    if (connError) return fail(connError);
    const {profile, error: profileError} = validateProfile(body.profile);
    if (profileError) return fail(profileError);
    const {header, error: headerError} = validateHeader(body.header);
    if (headerError) return fail(headerError);

    return {printer: {id: id ?? body.id, name, connection, profile, header}};
}

export const MAIN_PROFILE_DEFAULTS = Object.freeze({
    ...DEFAULT_EXTRA_PROFILE,
    headerPosition: 'trailing', // historical default of existing installs
});
export const PRINT_TYPES = ['totals', 'tickets', 'both'];

// Main printer: same connection/profile rules + what only the register's
// printer has (cash drawer, which tickets a direct sale prints).
export function validateMainPrinter(body = {}) {
    const {connection, error: connError} = validateConnection(body.connection);
    if (connError) return fail(connError);
    const {profile, error: profileError} = validateProfile(body.profile, {defaults: MAIN_PROFILE_DEFAULTS, withDrawer: true});
    if (profileError) return fail(profileError);
    const printType = body.printType ?? 'totals';
    if (!PRINT_TYPES.includes(printType)) return fail('Tipo de impressão inválido.');
    const main = {connection, profile, printType, openDrawer: body.openDrawer === true};
    // header is optional here (absent = keep the current one); the main
    // printer has no "same as main" mode
    if (body.header !== undefined) {
        const {header, error: headerError} = validateHeader({mode: 'custom', ...body.header});
        if (headerError) return fail(headerError);
        if (header.mode === 'main') return fail('Tipo de cabeçalho inválido.');
        main.header = header;
    }
    return {main};
}

// Stored list → normalized list (drops anything invalid instead of failing
// every print because of one bad entry).
export function normalizeExtraPrinters(stored) {
    if (!Array.isArray(stored)) return [];
    const result = [];
    for (const entry of stored) {
        if (!entry || typeof entry.id !== 'string') continue;
        const {printer} = validateExtraPrinter(entry, {id: entry.id});
        if (printer) result.push(printer);
    }
    return result.slice(0, MAX_EXTRA_PRINTERS);
}

// zoneId → printerId; keeps only routes to printers that still exist
export function normalizeRoutes(stored, printerIds) {
    const valid = new Set(printerIds);
    const routes = {};
    if (!stored || typeof stored !== 'object') return routes;
    for (const [zoneId, printerId] of Object.entries(stored)) {
        if (Number.isInteger(Number(zoneId)) && valid.has(printerId)) {
            routes[Number(zoneId)] = printerId;
        }
    }
    return routes;
}

export const describeConnection = (connection) => (connection?.type === 'network'
    ? `${connection.host}:${connection.port}`
    : connection?.systemName ?? '');
