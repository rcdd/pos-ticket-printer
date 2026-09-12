import {describe, expect, it} from 'vitest';
import {centsToEuros, cartTotal} from './money.js';

describe('centsToEuros', () => {
    it('converte cêntimos para euros formatados', () => {
        expect(centsToEuros(150).replace(/ /g, ' ')).toBe('1,50 €');
        expect(centsToEuros(0).replace(/ /g, ' ')).toBe('0,00 €');
        expect(centsToEuros(123456).replace(/ /g, ' ')).toBe('1234,56 €');
    });

    it('trata valores inválidos como zero', () => {
        expect(centsToEuros(undefined).replace(/ /g, ' ')).toBe('0,00 €');
        expect(centsToEuros('abc').replace(/ /g, ' ')).toBe('0,00 €');
    });
});

describe('cartTotal', () => {
    it('soma preço × quantidade', () => {
        expect(cartTotal([
            {price: 150, quantity: 2},
            {price: 950, quantity: 1},
        ])).toBe(1250);
    });

    it('carrinho vazio dá zero', () => {
        expect(cartTotal([])).toBe(0);
    });
});
