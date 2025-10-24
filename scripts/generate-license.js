#!/usr/bin/env node

import crypto from "crypto";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SIGNATURE_LENGTH = 6;
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg.startsWith("--")) {
        const [key, value] = arg.split("=", 2);
        if (value !== undefined) {
            options[key.slice(2)] = value;
            continue;
        }

        if (next && !next.startsWith("--")) {
            options[key.slice(2)] = next;
            i += 1;
        } else {
            options[key.slice(2)] = true;
        }
    }
}

const exitWithUsage = (message) => {
    if (message) {
        console.error(message);
        console.error();
    }
    console.error("Utilização: node scripts/generate-license.js --tenant CODIGO_CLIENTE [--days 365] [--secret CODIGO_INSTALACAO] [--expires YYYY-MM-DD]");
    console.error("Por omissão é usada a variável de ambiente LICENSE_INSTALLATION_CODE (ou LICENSE_SECRET).");
    process.exit(1);
};

const sanitizeTenant = (tenant) => {
    const upper = String(tenant || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!upper) {
        exitWithUsage("É obrigatório indicar o código do cliente (apenas letras e dígitos).");
    }
    if (upper.length < 2 || upper.length > 12) {
        exitWithUsage("O código do cliente deve ter entre 2 e 12 caracteres.");
    }
    return upper;
};

const toBase32 = (value) => {
    if (value === 0) return "0";
    let num = value;
    let result = "";
    while (num > 0) {
        result = CROCKFORD_BASE32[num % 32] + result;
        num = Math.floor(num / 32);
    }
    return result;
};

const encodeSignature = (payload, secret) => {
    const digest = crypto.createHmac("sha256", secret).update(payload).digest();
    let bits = "";
    for (const byte of digest) {
        bits += byte.toString(2).padStart(8, "0");
    }

    let signature = "";
    for (let i = 0; i + 5 <= bits.length && signature.length < SIGNATURE_LENGTH; i += 5) {
        const chunk = bits.slice(i, i + 5);
        const index = parseInt(chunk, 2);
        signature += CROCKFORD_BASE32[index];
    }
    return signature;
};

const tenant = sanitizeTenant(options.tenant ?? options.t);
const secret = options.secret || process.env.LICENSE_INSTALLATION_CODE || process.env.LICENSE_SECRET;

if (!secret) {
    exitWithUsage("É necessário indicar o código de instalação (defina LICENSE_INSTALLATION_CODE ou utilize --secret).");
}

const daysOption = options.days ?? options.d;
let expiresAt;

if (options.expires) {
    const parsed = new Date(options.expires);
    if (Number.isNaN(parsed.getTime())) {
        exitWithUsage("Valor inválido em --expires. Utilize o formato YYYY-MM-DD.");
    }
    expiresAt = parsed;
} else if (daysOption !== undefined) {
    const daysNumber = Number(daysOption);
    if (!Number.isFinite(daysNumber) || daysNumber <= 0) {
        exitWithUsage("Valor inválido em --days.");
    }
    expiresAt = new Date(Date.now() + daysNumber * MILLIS_IN_DAY);
} else {
    expiresAt = new Date(Date.now() + 365 * MILLIS_IN_DAY);
}

const daysSinceEpoch = Math.floor(expiresAt.getTime() / MILLIS_IN_DAY);
const expirySegment = toBase32(daysSinceEpoch);
const payload = `${tenant}.${expirySegment}`;
const signature = encodeSignature(payload, secret.toUpperCase());
const token = `${tenant}-${expirySegment}-${signature}`;

console.log("Licença gerada com sucesso:");
console.log(`  Cliente : ${tenant}`);
console.log(`  Expira  : ${expiresAt.toISOString().slice(0, 10)}`);
console.log(`  Código  : ${token}`);
