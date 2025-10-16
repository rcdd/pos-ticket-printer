export function computeSessionAggregates(invoices = [], initialAmountCents = 0, cashMovements = []) {
    let totalAmount = 0;
    const paymentsMap = new Map();
    const productsMap = new Map();
    const discountedMap = new Map();
    let cashTotal = initialAmountCents ?? 0;

    for (const inv of invoices ?? []) {
        if (inv?.isDeleted) continue;

        const invTotal = inv?.total ?? 0;
        const method = inv?.paymentMethod ?? "cash";
        totalAmount += invTotal;
        paymentsMap.set(method, (paymentsMap.get(method) ?? 0) + invTotal);
        if (method === "cash") cashTotal += invTotal;

        for (const rec of inv?.records ?? []) {
            const product = rec?.productItem;
            if (!product) continue;

            const qty = Number(rec?.quantity || 0);
            const price = Number(product?.price || 0);
            const hasDiscount = inv?.discountPercent && inv.discountPercent > 0;

            if (hasDiscount) {
                const discPct = inv.discountPercent;
                const discountedPrice = Math.round(price * (1 - discPct / 100));
                const key = `${product.id}-${discPct}`;
                const prev = discountedMap.get(key) ?? {
                    id: product.id,
                    name: product.name,
                    zone: product.zone,
                    quantity: 0,
                    total: 0,
                    discount: discPct,
                };
                prev.quantity += qty;
                prev.total += discountedPrice * qty;
                discountedMap.set(key, prev);
            } else {
                const prev = productsMap.get(product.id) ?? {
                    id: product.id,
                    name: product.name,
                    zone: product.zone,
                    quantity: 0,
                    total: 0,
                };
                prev.quantity += qty;
                prev.total += price * qty;
                productsMap.set(product.id, prev);
            }
        }
    }

    const cashIn = sumByType(cashMovements, "CASH_IN");
    const cashOut = sumByType(cashMovements, "CASH_OUT");
    const netAdjustments = cashIn - cashOut;
    const finalCashValueCents = cashTotal + netAdjustments;

    return {
        totalAmountCents: totalAmount,
        paymentsAgg: Array.from(paymentsMap, ([method, amount]) => ({method, amount})),
        productsAgg: Array.from(productsMap.values()),
        discountedProductsAgg: Array.from(discountedMap.values()),
        finalCashValueCents,
        cashIn,
        cashOut,
        netAdjustments,
    };
}

export function sumByType(movs = [], type) {
    return (movs ?? [])
        .filter((m) => m?.type === type)
        .reduce((acc, m) => acc + Number(m?.amount || 0), 0);
}
