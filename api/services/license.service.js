import crypto from 'crypto';
import db from '../db/index.js';

const Option = db.options;

const OPTION_LICENSE_TOKEN = 'license_token';
const OPTION_LICENSE_LAST_CHECK = 'license_last_check';
const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SIGNATURE_LENGTH = 6;
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

const defaultState = {
    valid: false,
    status: 'missing',
    message: 'Não existe licença instalada.',
    tenant: null,
    expiresAt: null,
    expiresAtIso: null,
    token: null,
    lastCheckedAt: null,
};

let cachedState = {...defaultState};

export class LicenseError extends Error {
    constructor(message, reason = 'invalid') {
        super(message);
        this.reason = reason;
        this.name = 'LicenseError';
    }
}

const upper = (value) => (value || '').toString().trim().toUpperCase();

const decodeBase32 = (encoded) => {
    const chars = upper(encoded).split('');
    if (!chars.length) {
        throw new LicenseError('O segmento de expiração da licença está vazio.', 'invalid_format');
    }

    return chars.reduce((acc, char) => {
        const index = CROCKFORD_BASE32.indexOf(char);
        if (index === -1) {
            throw new LicenseError(`Carácter "${char}" inválido no segmento de expiração da licença.`, 'invalid_format');
        }
        return acc * 32 + index;
    }, 0);
};

const encodeSignature = (payload, secret) => {
    const digest = crypto.createHmac('sha256', secret).update(payload).digest();
    let bits = '';
    for (const byte of digest) {
        bits += byte.toString(2).padStart(8, '0');
    }

    let output = '';
    for (let i = 0; i + 5 <= bits.length && output.length < SIGNATURE_LENGTH; i += 5) {
        const slice = bits.slice(i, i + 5);
        const index = parseInt(slice, 2);
        output += CROCKFORD_BASE32[index];
    }

    return output;
};

const readOption = async (name) => {
    const row = await Option.findOne({where: {name}});
    return row?.value ?? null;
};

const writeOption = async (name, value) => {
    await Option.upsert({name, value: value ?? ''});
};

const deleteOption = async (name) => {
    await Option.destroy({where: {name}});
};

const formatExpiryIso = (expiresAt) => {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const evaluateToken = (token, secret) => {
    if (!secret) {
        throw new LicenseError('A variável de ambiente LICENSE_SECRET não está configurada.', 'misconfigured');
    }

    const cleanToken = upper(token).replace(/[^0-9A-Z\-]/g, '');
    const segments = cleanToken.split('-').filter(Boolean);

    if (segments.length !== 3) {
        throw new LicenseError('O código de licença tem de conter três segmentos (TENANT-EXP-ASSINATURA).', 'invalid_format');
    }

    const [tenant, expirySegment, signature] = segments;

    if (!tenant || tenant.length < 2 || tenant.length > 12) {
        throw new LicenseError('O segmento do cliente é inválido ou está em falta.', 'invalid_format');
    }

    if (!signature || signature.length !== SIGNATURE_LENGTH) {
        throw new LicenseError(`O segmento da assinatura tem de conter ${SIGNATURE_LENGTH} caracteres.`, 'invalid_format');
    }

    const payload = `${tenant}.${expirySegment}`;
    const expectedSignature = encodeSignature(payload, secret);
    if (signature !== expectedSignature) {
        throw new LicenseError('A assinatura da licença é inválida.', 'invalid_signature');
    }

    const daysSinceEpoch = decodeBase32(expirySegment);
    const expiresAtEnd = (daysSinceEpoch + 1) * MILLIS_IN_DAY - 1;

    return {
        tenant,
        expiresAt: expiresAtEnd,
        expiresAtIso: formatExpiryIso(expiresAtEnd),
        token: cleanToken,
        status: 'valid',
        valid: true,
        message: `Licença válida até ${new Date(expiresAtEnd).toISOString().slice(0, 10)}.`,
    };
};

const updateCachedState = (nextState) => {
    cachedState = {...defaultState, ...nextState};
    return cachedState;
};

export const getLicenseState = () => cachedState;

const evaluateStoredLicense = async () => {
    const secret = process.env.LICENSE_SECRET;
    const token = await readOption(OPTION_LICENSE_TOKEN);
    const lastCheckRaw = await readOption(OPTION_LICENSE_LAST_CHECK);

    if (!secret) {
        return {
            valid: false,
            status: 'misconfigured',
            message: 'A variável de ambiente LICENSE_SECRET não está configurada.',
            tenant: null,
            expiresAt: null,
            expiresAtIso: null,
            token: null,
            lastCheckedAt: null,
        };
    }

    if (!token) {
        return {...defaultState};
    }

    let baseState;
    try {
        baseState = evaluateToken(token, secret);
    } catch (error) {
        if (error instanceof LicenseError) {
            return updateCachedState({
                valid: false,
                status: error.reason,
                message: error.message,
                tenant: null,
                expiresAt: null,
                expiresAtIso: null,
                token,
                lastCheckedAt: null,
            });
        }
        throw error;
    }

    const now = Date.now();
    let lastCheckedAt = null;

    if (lastCheckRaw) {
        const parsed = Number(lastCheckRaw);
        if (!Number.isFinite(parsed)) {
            return updateCachedState({
                valid: false,
                status: 'invalid_last_check',
                message: 'O registo da última verificação da licença é inválido.',
                tenant: baseState.tenant,
                expiresAt: baseState.expiresAt,
                expiresAtIso: baseState.expiresAtIso,
                token: baseState.token,
                lastCheckedAt: null,
            });
        }
        lastCheckedAt = parsed;

        if (parsed - now > MILLIS_IN_DAY) {
            return updateCachedState({
                valid: false,
                status: 'clock_rollback',
                message: 'O relógio do sistema parece ter sido alterado. Contacte o suporte para obter uma nova licença.',
                tenant: baseState.tenant,
                expiresAt: baseState.expiresAt,
                expiresAtIso: baseState.expiresAtIso,
                token: baseState.token,
                lastCheckedAt: parsed,
            });
        }
    }

    if (baseState.expiresAt < now) {
        return updateCachedState({
            valid: false,
            status: 'expired',
            message: `A Licença expirou em ${new Date(baseState.expiresAt).toISOString().slice(0, 10)}.`,
            tenant: baseState.tenant,
            expiresAt: baseState.expiresAt,
            expiresAtIso: baseState.expiresAtIso,
            token: baseState.token,
            lastCheckedAt,
        });
    }

    await writeOption(OPTION_LICENSE_LAST_CHECK, String(now));

    return updateCachedState({
        ...baseState,
        valid: true,
        status: 'valid',
        message: baseState.message,
        lastCheckedAt: now,
    });
};

export const initLicenseState = async () => {
    const state = await evaluateStoredLicense();
    updateCachedState(state);
    return state;
};

const needsRefresh = (state) => {
    if (!state) return true;
    if (state.status === 'misconfigured') return false;
    const now = Date.now();

    if (state.valid && state.expiresAt && now > state.expiresAt) {
        return true;
    }

    if (state.valid && state.lastCheckedAt && (now - state.lastCheckedAt) > MILLIS_IN_DAY) {
        return true;
    }

    if (state.token && !state.valid && state.status !== 'missing') {
        // allow retry after manual DB changes or secret updates
        return (now - (state.lastCheckedAt ?? 0)) > MILLIS_IN_DAY;
    }

    return false;
};

export const ensureLicenseState = async () => {
    if (needsRefresh(cachedState)) {
        return evaluateStoredLicense();
    }
    return cachedState;
};

export const applyLicense = async (token) => {
    if (!token) {
        throw new LicenseError('É obrigatório indicar o código de licença.', 'invalid_format');
    }

    const secret = process.env.LICENSE_SECRET;
    const evaluation = evaluateToken(token, secret);
    const now = Date.now();

    if (evaluation.expiresAt < now) {
        throw new LicenseError(
            `A licença já expirou em ${new Date(evaluation.expiresAt).toISOString().slice(0, 10)}.`,
            'expired',
        );
    }

    await writeOption(OPTION_LICENSE_TOKEN, evaluation.token);
    await writeOption(OPTION_LICENSE_LAST_CHECK, String(now));

    const nextState = {
        ...evaluation,
        valid: true,
        status: 'valid',
        message: evaluation.message,
        lastCheckedAt: now,
    };

    updateCachedState(nextState);
    return nextState;
};

export const clearLicense = async () => {
    await deleteOption(OPTION_LICENSE_TOKEN);
    await deleteOption(OPTION_LICENSE_LAST_CHECK);
    return updateCachedState({...defaultState});
};

export const enforceLicense = async (req, res, next) => {
    const state = await ensureLicenseState();
    if (state.valid) {
        return next();
    }

    return res.status(state.status === 'missing' ? 428 : 402).json({
        message: state.message,
        status: state.status,
        valid: false,
        tenant: state.tenant,
        expiresAt: state.expiresAt,
        expiresAtIso: state.expiresAtIso,
        lastCheckedAt: state.lastCheckedAt,
    });
};
