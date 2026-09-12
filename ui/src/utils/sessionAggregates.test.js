import {computeSessionAggregates, sumByType} from './sessionAggregates';

const makeInvoice = (overrides = {}) => ({
    total: 1000,
    paymentMethod: 'cash',
    isDeleted: false,
    discountPercent: 0,
    records: [],
    ...overrides,
});

const beer = {id: 1, name: 'Imperial', price: 150, zone: {name: 'Bar'}};
const dish = {id: 2, name: 'Francesinha', price: 950, zone: {name: 'Cozinha'}};

describe('computeSessionAggregates', () => {
    it('soma totais e agrega por método de pagamento', () => {
        const result = computeSessionAggregates([
            makeInvoice({total: 1000, paymentMethod: 'cash'}),
            makeInvoice({total: 500, paymentMethod: 'card'}),
            makeInvoice({total: 300, paymentMethod: 'cash'}),
        ], 0, []);

        expect(result.totalAmountCents).toBe(1800);
        expect(result.paymentsAgg).toEqual(expect.arrayContaining([
            {method: 'cash', amount: 1300},
            {method: 'card', amount: 500},
        ]));
    });

    it('ignora faturas anuladas', () => {
        const result = computeSessionAggregates([
            makeInvoice({total: 1000}),
            makeInvoice({total: 9999, isDeleted: true}),
        ], 0, []);

        expect(result.totalAmountCents).toBe(1000);
    });

    it('só o dinheiro entra no valor de caixa (mais o fundo inicial)', () => {
        const result = computeSessionAggregates([
            makeInvoice({total: 1000, paymentMethod: 'cash'}),
            makeInvoice({total: 500, paymentMethod: 'card'}),
        ], 2000, []);

        expect(result.finalCashValueCents).toBe(2000 + 1000);
    });

    it('agrega produtos por quantidade e separa vendas com desconto', () => {
        const result = computeSessionAggregates([
            makeInvoice({
                records: [
                    {quantity: 2, productItem: beer},
                    {quantity: 1, productItem: dish},
                ],
            }),
            makeInvoice({
                discountPercent: 50,
                records: [{quantity: 2, productItem: beer}],
            }),
        ], 0, []);

        const beerAgg = result.productsAgg.find((p) => p.id === beer.id);
        expect(beerAgg.quantity).toBe(2);
        expect(beerAgg.total).toBe(300);

        expect(result.discountedProductsAgg).toHaveLength(1);
        expect(result.discountedProductsAgg[0]).toMatchObject({
            id: beer.id,
            quantity: 2,
            discount: 50,
            total: 2 * Math.round(150 * 0.5),
        });
    });

    it('reforços e sangrias entram no valor final de caixa', () => {
        const result = computeSessionAggregates(
            [makeInvoice({total: 1000, paymentMethod: 'cash'})],
            500,
            [
                {type: 'CASH_IN', amount: 200},
                {type: 'CASH_OUT', amount: 300},
                {type: 'CASH_OUT', amount: 100},
            ],
        );

        expect(result.cashIn).toBe(200);
        expect(result.cashOut).toBe(400);
        expect(result.netAdjustments).toBe(-200);
        expect(result.finalCashValueCents).toBe(500 + 1000 - 200);
    });

    it('aguenta entradas vazias/malformadas', () => {
        const result = computeSessionAggregates(undefined, undefined, undefined);
        expect(result.totalAmountCents).toBe(0);
        expect(result.productsAgg).toEqual([]);
    });
});

describe('sumByType', () => {
    it('soma apenas os movimentos do tipo pedido', () => {
        const movements = [
            {type: 'CASH_IN', amount: 100},
            {type: 'CASH_OUT', amount: 40},
            {type: 'CASH_IN', amount: '60'},
        ];
        expect(sumByType(movements, 'CASH_IN')).toBe(160);
        expect(sumByType(movements, 'CASH_OUT')).toBe(40);
        expect(sumByType([], 'CASH_IN')).toBe(0);
    });
});
