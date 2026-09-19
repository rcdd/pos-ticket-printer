// Normalizes/validates the payment parcels of an invoice. Pure module so the
// three invoice-creation paths (direct sale, order pay, table pay) share the
// exact same rules — and so it is unit-testable.
export const PAYMENT_METHODS = Object.freeze(['cash', 'card', 'mbway', 'other']);

// Returns {payments, primaryMethod} or {error: message}.
// - no parcels sent → one parcel with the fallback method for the full total
// - parcels sent → every method valid, every amount a positive integer of
//   cents, and the sum MUST equal the (discounted) total
export function normalizePayments(rawPayments, fallbackMethod, totalCents) {
    if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
        return {
            payments: [{method: fallbackMethod, amount: totalCents}],
            primaryMethod: fallbackMethod,
        };
    }

    const payments = [];
    for (const raw of rawPayments) {
        const method = String(raw?.method ?? '');
        const amount = Number(raw?.amount);
        if (!PAYMENT_METHODS.includes(method)) {
            return {error: `Método de pagamento inválido: '${method}'.`};
        }
        if (!Number.isInteger(amount) || amount <= 0) {
            return {error: "Cada parcela tem de ter um valor positivo (em cêntimos)."};
        }
        payments.push({method, amount});
    }

    const sum = payments.reduce((acc, p) => acc + p.amount, 0);
    if (sum !== totalCents) {
        return {error: `As parcelas somam ${(sum / 100).toFixed(2)}€ mas o total é ${(totalCents / 100).toFixed(2)}€.`};
    }

    // primary method (invoice column, back-compat): the largest parcel wins
    const primaryMethod = [...payments].sort((a, b) => b.amount - a.amount)[0].method;
    return {payments, primaryMethod};
}

// Aggregates parcels per method (for receipts/summaries): [{method, amount}]
export function paymentsByMethod(payments) {
    const map = new Map();
    for (const p of payments ?? []) {
        map.set(p.method, (map.get(p.method) ?? 0) + p.amount);
    }
    return [...map.entries()].map(([method, amount]) => ({method, amount}));
}
