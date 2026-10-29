// Why a sale was discounted (e.g. "Banda", "Técnicos de som"), so offers
// such as the committee paying the band's dinner stay recorded.
export const DISCOUNT_NOTE_MAX_LENGTH = 120;

// Only meaningful on a discounted sale: without a discount, or when the note
// is blank, nothing is stored.
export function normalizeDiscountNote(raw, discountPercent) {
    if (!(Number(discountPercent) > 0) || typeof raw !== 'string') return null;
    const note = raw.replace(/\s+/g, ' ').trim().slice(0, DISCOUNT_NOTE_MAX_LENGTH).trim();
    return note === '' ? null : note;
}
