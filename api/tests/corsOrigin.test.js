import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedOrigin, isLocalNetworkOrigin} from '../services/corsOrigin.js';

test('the POS itself and the configured origins are allowed', () => {
    assert.ok(isAllowedOrigin('http://localhost:3000'));
    assert.ok(isAllowedOrigin('https://pos.rubendomingues.pt', ['https://pos.rubendomingues.pt']));
    assert.ok(isAllowedOrigin(undefined));
});

test('the admin UI opened from another computer on the local network is allowed', () => {
    for (const origin of [
        'http://192.168.1.50:3000',
        'http://10.0.0.7:3000',
        'http://172.16.4.2:3000',
        'http://172.31.255.1:3000',
        'http://169.254.12.34:3000', // direct cable, no router
        'http://127.0.0.1:3000',
    ]) {
        assert.ok(isLocalNetworkOrigin(origin), origin);
    }
});

test('public and malformed origins are refused', () => {
    for (const origin of [
        'https://evil.example',
        'http://8.8.8.8:3000',
        'http://172.32.0.1:3000',
        'http://192.169.1.1:3000',
        'http://192.168.1.50.evil.example',
        'file:///C:/x.html',
        'null',
        'not a url',
    ]) {
        assert.equal(isAllowedOrigin(origin), false, origin);
    }
});
