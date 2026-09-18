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
    it('sums totals and aggregates by payment method', () => {
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

    it('ignores voided invoices', () => {
        const result = computeSessionAggregates([
            makeInvoice({total: 1000}),
            makeInvoice({total: 9999, isDeleted: true}),
        ], 0, []);

        expect(result.totalAmountCents).toBe(1000);
    });

    it('only cash counts towards the drawer value (plus the opening float)', () => {
        const result = computeSessionAggregates([
            makeInvoice({total: 1000, paymentMethod: 'cash'}),
            makeInvoice({total: 500, paymentMethod: 'card'}),
        ], 2000, []);

        expect(result.finalCashValueCents).toBe(2000 + 1000);
    });

    it('aggregates products by quantity and separates discounted sales', () => {
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

    it('cash-ins and cash-outs affect the final drawer value', () => {
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

    it('handles empty/malformed input', () => {
        const result = computeSessionAggregates(undefined, undefined, undefined);
        expect(result.totalAmountCents).toBe(0);
        expect(result.productsAgg).toEqual([]);
    });
});

describe('sumByType', () => {
    it('sums only movements of the requested type', () => {
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

test('uses the price recorded at sale time, not the current product price', () => {
    const invoices = [{
        isDeleted: false,
        total: 400,
        paymentMethod: 'cash',
        records: [
            // product price was raised to 300 AFTER this sale of 2 × 200
            {quantity: 2, price: 200, productItem: {id: 1, name: 'Bifana', price: 300}},
            // legacy record without stored price falls back to the current one
            {quantity: 1, productItem: {id: 2, name: 'Imperial', price: 120}},
        ],
    }];
    const {productsAgg} = computeSessionAggregates(invoices, 0, []);
    const bifana = productsAgg.find((p) => p.id === 1);
    const imperial = productsAgg.find((p) => p.id === 2);
    expect(bifana.total).toBe(400);
    expect(imperial.total).toBe(120);
});
