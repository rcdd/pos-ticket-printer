// Pure helper for products sold as a bundle of individual tickets (senhas):
// "Metro de Cerveja" = one product at 10€ that prints 10 "Cerveja" tickets the
// customer redeems one at a time. Kept free of DB imports so it is
// unit-testable; the caller supplies the productId → bundle map.

export const MAX_TICKETS_PER_UNIT = 50;

// "senhas individuais" fields, normalized: whole number 1..50 and a trimmed
// label (empty → null, i.e. the product name). Only the fields present in the
// body are returned, so a partial update leaves the others untouched.
export const ticketFields = (body) => {
    const fields = {};
    if (body.ticketsPerUnit !== undefined) {
        const count = Math.trunc(Number(body.ticketsPerUnit));
        fields.ticketsPerUnit = Number.isFinite(count)
            ? Math.min(MAX_TICKETS_PER_UNIT, Math.max(1, count))
            : 1;
    }
    if (body.ticketLabel !== undefined) {
        const label = typeof body.ticketLabel === 'string' ? body.ticketLabel.trim().slice(0, 20) : '';
        fields.ticketLabel = label || null;
    }
    return fields;
};

// Products → Map(productId → {count, label, name}) for the ones that print
// more than one ticket per unit.
export function bundlesFromProducts(products = []) {
    const bundles = new Map();
    for (const p of products) {
        const count = Math.trunc(Number(p?.ticketsPerUnit) || 1);
        if (count <= 1) continue;
        const name = String(p?.name || '').trim();
        const label = String(p?.ticketLabel || '').trim() || name;
        bundles.set(Number(p.id), {count, label, name});
    }
    return bundles;
}

// Ticket lines ({productId, name}, one per unit) → the same lines with every
// bundle unit replaced by its individual tickets: {name: label, subtitle:
// "Metro de Cerveja 3/10", bundle: true}. Other lines pass through untouched.
export function expandTicketBundles(lines = [], bundles = new Map()) {
    if (bundles.size === 0) return lines;
    const out = [];
    for (const line of lines) {
        const bundle = bundles.get(Number(line?.productId));
        if (!bundle) {
            out.push(line);
            continue;
        }
        for (let i = 1; i <= bundle.count; i++) {
            out.push({
                productId: line.productId,
                name: bundle.label,
                subtitle: `${bundle.name} ${i}/${bundle.count}`,
                bundle: true,
            });
        }
    }
    return out;
}
