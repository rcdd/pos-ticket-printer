import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const {generateAuthToken, refreshAuthToken} = await import('../services/token.service.js');

test('generateAuthToken devolve token com expiração futura', () => {
    const {token, expiresAt} = generateAuthToken({id: 1, role: 'admin'});
    assert.ok(token.split('.').length === 3, 'esperava um JWT');
    assert.ok(expiresAt > Date.now());
});

test('generateAuthToken exige id e role', () => {
    assert.throws(() => generateAuthToken({}), /id and role/);
    assert.throws(() => generateAuthToken({id: 1}), /id and role/);
});

test('refreshAuthToken renova o token mantendo o payload', () => {
    const {token} = generateAuthToken({id: 42, role: 'waiter'});
    const refreshed = refreshAuthToken(token);
    assert.equal(refreshed.payload.id, 42);
    assert.equal(refreshed.payload.role, 'waiter');
    assert.ok(refreshed.renewedToken);
    assert.ok(refreshed.expiresAt >= refreshed.previousExpiresAt);
});

test('refreshAuthToken rejeita tokens inválidos ou ausentes', () => {
    assert.throws(() => refreshAuthToken(null), /ausente/);
    assert.throws(() => refreshAuthToken('nao-e-um-jwt'));

    const {token} = generateAuthToken({id: 1, role: 'admin'});
    const [h, p] = token.split('.');
    assert.throws(() => refreshAuthToken(`${h}.${p}.assinaturaerrada`));
});
