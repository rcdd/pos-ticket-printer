import db from '../db/index.js';
import {
    CROCKFORD_BASE32,
    FEATURES,
    LicenseError,
    MILLIS_IN_DAY,
    evaluateToken,
} from './licenseToken.js';

export {LicenseError, FEATURES};

const Option = db.options;

const OPTION_LICENSE_TOKEN = 'license_token';
const OPTION_LICENSE_LAST_CHECK = 'license_last_check';
const OPTION_LICENSE_INSTALLATION_CODE = 'license_installation_code';
const INSTALLATION_CODE_PREFIX = 'PTP';
const INSTALLATION_CODE_SEGMENT_LENGTH = 3;

const noFeatures = () => Object.fromEntries(Object.keys(FEATURES).map((name) => [name, false]));

const defaultState = {
    valid: false,
    status: 'missing',
    message: 'Não existe licença instalada.',
    tenant: null,
    expiresAt: null,
    expiresAtIso: null,
    token: null,
    lastCheckedAt: null,
    installationCode: null,
    features: noFeatures(),
};

let cachedState = {...defaultState};

const randomInstallationSegment = () => {
    let output = '';
    for (let i = 0; i < INSTALLATION_CODE_SEGMENT_LENGTH; i += 1) {
        const index = Math.floor(Math.random() * CROCKFORD_BASE32.length);
        output += CROCKFORD_BASE32[index];
    }
    return output;
};

const generateInstallationCode = () => `${INSTALLATION_CODE_PREFIX}-${randomInstallationSegment()}-${randomInstallationSegment()}`;

const readOption = async (name) => {
    const rows = await Option.findAll({where: {name}});
    const row = rows.reduce((latest, current) => {
        if (!latest) return current;
        return current.updatedAt > latest.updatedAt ? current : latest;
    }, null);

    return row?.value ?? null;
};

const readSingleOption = async (name) => {
    const rows = await Option.findAll({where: {name}});
    if (rows.length <= 1) {
        return rows[0] || null;
    }
    const [primary, ...duplicates] = rows;
    await Option.destroy({where: {id: duplicates.map((row) => row.id)}});
    return primary;
};

const writeOption = async (name, value) => {
    const existing = await readSingleOption(name);
    if (existing) {
        if (existing.value !== (value ?? '')) {
            await existing.update({value: value ?? ''});
        }
        return existing;
    }
    return Option.create({name, value: value ?? ''});
};

const deleteOption = async (name) => {
    await Option.destroy({where: {name}});
};

const ensureInstallationCode = async () => {
    const existing = await readSingleOption(OPTION_LICENSE_INSTALLATION_CODE);
    const fromDb = existing?.value?.toString().trim() ?? '';
    if (fromDb) {
        if (existing && existing.value !== fromDb) {
            await existing.update({value: fromDb});
        }
        return fromDb;
    }

    const fallback = process.env.LICENSE_SECRET?.toString().trim() ?? '';
    const code = fallback || generateInstallationCode();
    await writeOption(OPTION_LICENSE_INSTALLATION_CODE, code);
    return code;
};

const updateCachedState = (nextState) => {
    cachedState = {...defaultState, ...nextState};
    return cachedState;
};

export const getLicenseState = () => cachedState;

export const hasFeature = (name) => Boolean(cachedState.valid && cachedState.features?.[name]);

const evaluateStoredLicense = async () => {
    const installationCode = await ensureInstallationCode();
    const token = await readOption(OPTION_LICENSE_TOKEN);
    const lastCheckRaw = await readOption(OPTION_LICENSE_LAST_CHECK);

    if (!token) {
        return updateCachedState({
            ...defaultState,
            installationCode,
        });
    }

    let baseState;
    try {
        baseState = evaluateToken(token, installationCode);
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
                installationCode,
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
                installationCode,
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
                installationCode,
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
            features: baseState.features,
            lastCheckedAt,
            installationCode,
        });
    }

    await writeOption(OPTION_LICENSE_LAST_CHECK, String(now));

    return updateCachedState({
        ...baseState,
        valid: true,
        status: 'valid',
        message: baseState.message,
        lastCheckedAt: now,
        installationCode,
    });
};

export const initLicenseState = async () => {
    return evaluateStoredLicense();
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

    const installationCode = await ensureInstallationCode();
    const evaluation = evaluateToken(token, installationCode);
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
        installationCode,
    };

    return updateCachedState(nextState);
};

export const clearLicense = async () => {
    await deleteOption(OPTION_LICENSE_TOKEN);
    await deleteOption(OPTION_LICENSE_LAST_CHECK);
    const installationCode = await ensureInstallationCode();
    return updateCachedState({...defaultState, installationCode});
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
        installationCode: state.installationCode,
    });
};
