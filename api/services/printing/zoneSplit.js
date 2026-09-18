// Pure helper: groups order items by their product's zone (kitchen/bar/…),
// used to print one order ticket per section. Kept free of DB imports so it
// is unit-testable; the caller supplies the productId → zone-name map.
const collator = new Intl.Collator('pt-PT', {sensitivity: 'base'});

// Returns [{zoneLabel, items}], zone names sorted, no-zone group last with
// zoneLabel null (its ticket carries no destination line).
export function groupItemsByZone(items, zoneByProductId) {
    const groups = new Map();
    for (const item of items) {
        const zone = zoneByProductId.get(item.productId) ?? null;
        if (!groups.has(zone)) groups.set(zone, []);
        groups.get(zone).push(item);
    }
    return [...groups.entries()]
        .sort(([a], [b]) => {
            if (a === null) return 1;
            if (b === null) return -1;
            return collator.compare(a, b);
        })
        .map(([zoneLabel, groupItems]) => ({zoneLabel, items: groupItems}));
}
