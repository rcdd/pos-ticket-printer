import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePayments, paymentsByMethod} from '../services/payments.util.js';

test('no parcels → single payment with the fallback method', () => {
    const r = normalizePayments(undefined, 'mbway', 500);
    assert.deepEqual(r.payments, [{method: 'mbway', amount: 500}]);
    assert.equal(r.primaryMethod, 'mbway');
});

test('parcels must sum to the total', () => {
    const ok = normalizePayments([{method: 'cash', amount: 300}, {method: 'mbway', amount: 200}], 'cash', 500);
    assert.equal(ok.error, undefined);
    assert.equal(ok.primaryMethod, 'cash'); // largest parcel

    const bad = normalizePayments([{method: 'cash', amount: 300}], 'cash', 500);
    assert.match(bad.error, /somam/);
});

test('invalid methods and non-positive amounts are rejected', () => {
    assert.ok(normalizePayments([{method: 'bitcoin', amount: 500}], 'cash', 500).error);
    assert.ok(normalizePayments([{method: 'cash', amount: 0}], 'cash', 0).error);
    assert.ok(normalizePayments([{method: 'cash', amount: 2.5}], 'cash', 2.5).error);
});

test('paymentsByMethod aggregates parcels', () => {
    const agg = paymentsByMethod([
        {method: 'cash', amount: 200}, {method: 'mbway', amount: 100}, {method: 'cash', amount: 300},
    ]);
    assert.deepEqual(agg, [{method: 'cash', amount: 500}, {method: 'mbway', amount: 100}]);
});
