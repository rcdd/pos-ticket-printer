import crypto from 'crypto';

export const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SIGNATURE_LENGTH = 6;
export const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const FEATURE_SEGMENT_MAX_LENGTH = 4;

// Bitmask dos recursos licenciáveis. Bits desconhecidos são ignorados
// para que licenças futuras continuem válidas em versões antigas.
export const FEATURES = Object.freeze({
    multi: 1 << 0,
});

export class LicenseError extends Error {
    constructor(message, reason = 'invalid') {
        super(message);
        this.reason = reason;
        this.name = 'LicenseError';
    }
}

const upper = (value) => (value || '').toString().trim().toUpperCase();

export const decodeBase32 = (encoded, label = 'expiração') => {
    const chars = upper(encoded).split('');
    if (!chars.length) {
        throw new LicenseError(`O segmento de ${label} da licença está vazio.`, 'invalid_format');
    }

    return chars.reduce((acc, char) => {
        const index = CROCKFORD_BASE32.indexOf(char);
        if (index === -1) {
            throw new LicenseError(`Carácter "${char}" inválido no segmento de ${label} da licença.`, 'invalid_format');
        }
        return acc * 32 + index;
    }, 0);
};

export const encodeSignature = (payload, secret) => {
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

const emptyFeatures = () => {
    const features = {};
    for (const name of Object.keys(FEATURES)) {
        features[name] = false;
    }
    return features;
};

export const parseFeaturesSegment = (segment) => {
    const mask = decodeBase32(segment, 'funcionalidades');
    const features = emptyFeatures();
    for (const [name, bit] of Object.entries(FEATURES)) {
        features[name] = (mask & bit) !== 0;
    }
    return features;
};

/**
 * Valida um código de licença contra o segredo (installation code).
 *
 * Formatos aceites:
 *  - legado:  TENANT-EXP-ASSINATURA            (3 segmentos, sem funcionalidades extra)
 *  - atual:   TENANT-EXP-FEAT-ASSINATURA       (4 segmentos, FEAT = bitmask em base32)
 */
export const evaluateToken = (token, secret) => {
    if (!secret) {
        throw new LicenseError('O código de instalação não está configurado.', 'misconfigured');
    }

    const cleanToken = upper(token).replace(/[^0-9A-Z\-]/g, '');
    const segments = cleanToken.split('-').filter(Boolean);

    if (segments.length !== 3 && segments.length !== 4) {
        throw new LicenseError('O código de licença tem de conter três ou quatro segmentos (TENANT-EXP[-FEAT]-ASSINATURA).', 'invalid_format');
    }

    const hasFeatureSegment = segments.length === 4;
    const [tenant, expirySegment, featureSegment, signature] = hasFeatureSegment
        ? segments
        : [segments[0], segments[1], null, segments[2]];

    if (!tenant || tenant.length < 2 || tenant.length > 12) {
        throw new LicenseError('O segmento do cliente é inválido ou está em falta.', 'invalid_format');
    }

    if (!signature || signature.length !== SIGNATURE_LENGTH) {
        throw new LicenseError(`O segmento da assinatura tem de conter ${SIGNATURE_LENGTH} caracteres.`, 'invalid_format');
    }

    if (hasFeatureSegment && (!featureSegment || featureSegment.length > FEATURE_SEGMENT_MAX_LENGTH)) {
        throw new LicenseError('O segmento de funcionalidades da licença é inválido.', 'invalid_format');
    }

    const payload = hasFeatureSegment
        ? `${tenant}.${expirySegment}.${featureSegment}`
        : `${tenant}.${expirySegment}`;
    const expectedSignature = encodeSignature(payload, secret);
    if (signature !== expectedSignature) {
        throw new LicenseError('A assinatura da licença é inválida ou não é compativel com esta máquina.', 'invalid_signature');
    }

    const features = hasFeatureSegment ? parseFeaturesSegment(featureSegment) : emptyFeatures();

    const daysSinceEpoch = decodeBase32(expirySegment);
    const expiresAtEnd = (daysSinceEpoch + 1) * MILLIS_IN_DAY - 1;

    return {
        tenant,
        expiresAt: expiresAtEnd,
        expiresAtIso: new Date(expiresAtEnd).toISOString(),
        token: cleanToken,
        features,
        status: 'valid',
        valid: true,
        message: `Licença válida até ${new Date(expiresAtEnd).toISOString().slice(0, 10)}.`,
    };
};
