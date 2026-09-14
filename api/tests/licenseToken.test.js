import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateToken, LicenseError, parseFeaturesSegment} from '../services/licenseToken.js';

// Fixtures generated with scripts/generate-license.js (kept out of the repo) and the test secret below.
const SECRET = 'PTP-TEST-CODE';
const LEGACY_TOKEN = 'DEMO-NR8-VZ1SPJ';          // DEMO, expires 2031-01-01, no features
const MULTI_TOKEN = 'DEMO-NR8-1-DEHJF2';         // DEMO, expires 2031-01-01, features: multi
const EXPIRED_MULTI_TOKEN = 'FESTA-HTP-1-P4D008'; // FESTA, expired 2020-01-01, features: multi

test('legacy token (3 segments) stays valid, with no features', () => {
    const result = evaluateToken(LEGACY_TOKEN, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.tenant, 'DEMO');
    assert.equal(result.expiresAtIso.slice(0, 10), '2031-01-01');
    assert.equal(result.features.multi, false);
});

test('token with a features segment enables multi-terminal', () => {
    const result = evaluateToken(MULTI_TOKEN, SECRET);
    assert.equal(result.valid, true);
    assert.equal(result.tenant, 'DEMO');
    assert.equal(result.expiresAtIso.slice(0, 10), '2031-01-01');
    assert.equal(result.features.multi, true);
});

test('expiry date is not validated here (the service is responsible for that)', () => {
    const result = evaluateToken(EXPIRED_MULTI_TOKEN, SECRET);
    assert.equal(result.tenant, 'FESTA');
    assert.equal(result.expiresAtIso.slice(0, 10), '2020-01-01');
    assert.equal(result.features.multi, true);
    assert.ok(result.expiresAt < Date.now());
});

test('normalizes lowercase and whitespace', () => {
    const result = evaluateToken('  demo-nr8-1-dehjf2 ', SECRET);
    assert.equal(result.token, MULTI_TOKEN);
    assert.equal(result.features.multi, true);
});

test('wrong secret rejects the signature', () => {
    assert.throws(
        () => evaluateToken(MULTI_TOKEN, 'PTP-OUTRO-CODIGO'),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('tampering with the tenant invalidates the signature', () => {
    assert.throws(
        () => evaluateToken(LEGACY_TOKEN.replace('DEMO', 'HACK'), SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('tampering with the features segment invalidates the signature', () => {
    const tampered = MULTI_TOKEN.replace('-1-', '-3-');
    assert.throws(
        () => evaluateToken(tampered, SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('promoting a legacy token to 4 segments invalidates the signature', () => {
    const [tenant, exp, sig] = LEGACY_TOKEN.split('-');
    assert.throws(
        () => evaluateToken(`${tenant}-${exp}-1-${sig}`, SECRET),
        (err) => err instanceof LicenseError && err.reason === 'invalid_signature',
    );
});

test('wrong segment count is rejected as invalid format', () => {
    for (const bad of ['DEMO-NR8', 'DEMO-NR8-1-1-DEHJF2', '']) {
        assert.throws(
            () => evaluateToken(bad, SECRET),
            (err) => err instanceof LicenseError && err.reason === 'invalid_format',
        );
    }
});

test('missing secret is rejected as misconfigured', () => {
    assert.throws(
        () => evaluateToken(LEGACY_TOKEN, ''),
        (err) => err instanceof LicenseError && err.reason === 'misconfigured',
    );
});

test('parseFeaturesSegment ignores unknown bits (forward compatibility)', () => {
    const features = parseFeaturesSegment('Z'); // unknown high bits + bit 0
    assert.equal(typeof features.multi, 'boolean');
    assert.equal(features.multi, (31 & 1) !== 0);
});
