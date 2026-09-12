import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateToken, LicenseError, parseFeaturesSegment} from '../services/licenseToken.js';

// Fixtures geradas com scripts/generate-license.js (fora do repo) e o segredo de teste abaixo.
const SECRET = 'PTP-TEST-CODE';
const LEGACY_TOKEN = 'DEMO-NR8-VZ1SPJ';          // DEMO, expira 2031-01-01, sem features
const MULTI_TOKEN = 'DEMO-NR8-1-DEHJF2';         // DEMO, expira 2031-01-01, features: multi
const EXPIRED_MULTI_TOKEN = 'FESTA-HTP-1-P4D008'; // FESTA, expirou 2020-01-01, features: multi

test('token legado (3 segmentos) continua válido e sem features', () => {
    const result = evaluateToken(LEGACY_TOKEN, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.tenant, 'DEMO');
    assert.equal(result.expiresAtIso.slice(0, 10), '2031-01-01');
    assert.equal(result.features.multi, false);
});

test('token com segmento de features ativa multiposto', () => {
    const result = evaluateToken(MULTI_TOKEN, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.tenant, 'DEMO');
    assert.equal(result.expiresAtIso.slice(0, 10), '2031-01-01');
    assert.equal(result.features.multi, true);
});

test('a data de expiração não é validada aqui (responsabilidade do serviço)', () => {
    const result = evaluateToken(EXPIRED_MULTI_TOKEN, SECRET);
    assert.equal(result.tenant, 'FESTA');
    assert.equal(result.expiresAtIso.slice(0, 10), '2020-01-01');
    assert.equal(result.features.multi, true);
    assert.ok(result.expiresAt < Date.now());
});

test('normaliza minúsculas e espaços', () => {
    const result = evaluateToken('  demo-nr8-1-dehjf2 ', SECRET);
    assert.equal(result.token, MULTI_TOKEN);
    assert.equal(result.features.multi, true);
});

test('segredo errado rejeita a assinatura', () => {
    assert.throws(
        () => evaluateToken(MULTI_TOKEN, 'PTP-OUTRO-CODIGO'),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('adulterar o tenant invalida a assinatura', () => {
    assert.throws(
        () => evaluateToken(LEGACY_TOKEN.replace('DEMO', 'HACK'), SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('adulterar o segmento de features invalida a assinatura', () => {
    const tampered = MULTI_TOKEN.replace('-1-', '-3-');
    assert.throws(
        () => evaluateToken(tampered, SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('promover um token legado a 4 segmentos invalida a assinatura', () => {
    const [tenant, exp, sig] = LEGACY_TOKEN.split('-');
    assert.throws(
        () => evaluateToken(`${tenant}-${exp}-1-${sig}`, SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('número errado de segmentos é rejeitado como formato inválido', () => {
    for (const bad of ['DEMO-NR8', 'DEMO-NR8-1-1-DEHJF2', '']) {
        assert.throws(
            () => evaluateToken(bad, SECRET),
            (err) => err instanceof LicenseError && err.reason === 'invalid_format',
        );
    }
});

test('sem segredo configurado é rejeitado como misconfigured', () => {
    assert.throws(
        () => evaluateToken(LEGACY_TOKEN, ''),
        (err) => err instanceof LicenseError && err.reason === 'misconfigured',
    );
});

test('parseFeaturesSegment ignora bits desconhecidos (compatibilidade futura)', () => {
    const features = parseFeaturesSegment('Z'); // bits altos desconhecidos + bit 0
    assert.equal(typeof features.multi, 'boolean');
    assert.equal(features.multi, (31 & 1) !== 0);
});
