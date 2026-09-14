import {describe, expect, it} from 'vitest';
import {centsToEuros, cartTotal} from './money.js';

describe('centsToEuros', () => {
    it('converts cents to formatted euros', () => {
        expect(centsToEuros(150).replace(/ /g, ' ')).toBe('1,50 €');
        expect(centsToEuros(0).replace(/ /g, ' ')).toBe('0,00 €');
        expect(centsToEuros(123456).replace(/ /g, ' ')).toBe('1234,56 €');
    });

    it('treats invalid values as zero', () => {
        expect(centsToEuros(undefined).replace(/ /g, ' ')).toBe('0,00 €');
        expect(centsToEuros('abc').replace(/ /g, ' ')).toBe('0,00 €');
    });
});

describe('cartTotal', () => {
    it('sums price × quantity', () => {
        expect(cartTotal([
            {price: 150, quantity: 2},
            {price: 950, quantity: 1},
        ])).toBe(1250);
    });

    it('empty cart yields zero', () => {
        expect(cartTotal([])).toBe(0);
    });
});
