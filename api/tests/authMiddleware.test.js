import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const {generateAuthToken} = await import('../services/token.service.js');
const {authenticate, optionalAuthenticate} = await import('../middleware/auth.js');

const makeRes = () => {
    const res = {statusCode: 200, headers: {}, body: null};
    res.setHeader = (name, value) => {
        res.headers[name] = value;
    };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.send = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

const makeReq = (token, via = 'header') => ({
    headers: via === 'header' && token ? {authorization: `Bearer ${token}`} : {},
    query: via === 'query' && token ? {token} : {},
    body: via === 'body' && token ? {token} : {},
});

test('authenticate: sem token responde 401', () => {
    const res = makeRes();
    let called = false;
    authenticate(makeReq(null), res, () => {
        called = true;
    });
    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_TOKEN_INVALID');
});

test('authenticate: token válido popula req.user e renova o token', () => {
    const {token} = generateAuthToken({id: 9, role: 'cashier'});
    const req = makeReq(token);
    const res = makeRes();
    let called = false;

    authenticate(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(req.user.id, 9);
    assert.equal(req.user.role, 'cashier');
    assert.ok(res.headers['x-auth-token'], 'esperava token renovado no header');
    assert.ok(res.headers['x-auth-expires-at']);
});

test('authenticate: aceita token via query string (necessário para o SSE)', () => {
    const {token} = generateAuthToken({id: 3, role: 'waiter'});
    const req = makeReq(token, 'query');
    const res = makeRes();
    let called = false;

    authenticate(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(req.user.id, 3);
});

test('authenticate: token adulterado responde 401', () => {
    const {token} = generateAuthToken({id: 1, role: 'admin'});
    const res = makeRes();
    let called = false;

    authenticate(makeReq(token.slice(0, -2) + 'xx'), res, () => {
        called = true;
    });

    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_TOKEN_INVALID');
});

test('optionalAuthenticate: sem token segue sem utilizador', () => {
    const req = makeReq(null);
    const res = makeRes();
    let called = false;

    optionalAuthenticate(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(req.user, undefined);
});
