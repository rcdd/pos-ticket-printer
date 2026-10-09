// Pure helper: groups order items by their product's zone (kitchen/bar/…)
// and by the printer each zone is routed to. Kept free of DB imports so it
// is unit-testable; the caller supplies the productId → zone map.
const collator = new Intl.Collator('pt-PT', {sensitivity: 'base'});

export const MAIN_PRINTER_ID = 'main';

// Which printer gets which items. zoneByProductId maps productId → {id, name}
// (or null); routes maps zoneId → printerId (only the zones sent to another
// printer — everything else stays on the main one). With split on, one
// ticket per zone (destination line = zone name); with split off, one ticket
// per PRINTER, unlabelled — a printer can still only receive its own zones.
// Returns [{printerId, zoneLabel, items}] in zone order, no-zone last.
export function planPrintGroups(items, zoneByProductId, {routes = {}, split = true} = {}) {
    const byZone = new Map();
    for (const item of items) {
        const zone = zoneByProductId.get(item.productId) ?? null;
        const key = zone?.id ?? null;
        if (!byZone.has(key)) byZone.set(key, {zone, items: []});
        byZone.get(key).items.push(item);
    }
    const zoneGroups = [...byZone.values()].sort((a, b) => {
        if (!a.zone) return 1;
        if (!b.zone) return -1;
        return collator.compare(a.zone.name ?? '', b.zone.name ?? '');
    });

    const printerFor = (zone) => (zone && routes[zone.id]) || MAIN_PRINTER_ID;
    if (split) {
        return zoneGroups.map(({zone, items: groupItems}) => ({
            printerId: printerFor(zone),
            zoneLabel: zone?.name || null,
            items: groupItems,
        }));
    }
    const byPrinter = new Map();
    for (const {zone, items: groupItems} of zoneGroups) {
        const printerId = printerFor(zone);
        if (!byPrinter.has(printerId)) byPrinter.set(printerId, []);
        byPrinter.get(printerId).push(...groupItems);
    }
    return [...byPrinter.entries()].map(([printerId, groupItems]) => ({
        printerId,
        zoneLabel: null,
        items: groupItems,
    }));
}
