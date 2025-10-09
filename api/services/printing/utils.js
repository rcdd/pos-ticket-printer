export function toEuros(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
