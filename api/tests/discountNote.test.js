import test from 'node:test';
import assert from 'node:assert/strict';
import {DISCOUNT_NOTE_MAX_LENGTH, normalizeDiscountNote} from '../services/discountNote.js';

test('a discounted sale keeps its reason, tidied up', () => {
    assert.equal(normalizeDiscountNote('  Banda  ', 100), 'Banda');
    assert.equal(normalizeDiscountNote('Técnicos\n de   som', 50), 'Técnicos de som');
});

test('no discount or a blank reason stores nothing', () => {
    assert.equal(normalizeDiscountNote('Banda', 0), null);
    assert.equal(normalizeDiscountNote('Banda', undefined), null);
    assert.equal(normalizeDiscountNote('   ', 100), null);
    assert.equal(normalizeDiscountNote(undefined, 100), null);
    assert.equal(normalizeDiscountNote(42, 100), null);
});

test('a long reason is cut to the column size', () => {
    const note = normalizeDiscountNote('x'.repeat(500), 100);
    assert.equal(note.length, DISCOUNT_NOTE_MAX_LENGTH);
});
