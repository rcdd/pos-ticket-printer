// Prices come from the API in cents (INTEGER)
export const centsToEuros = (cents) => {
    const value = (Number(cents) || 0) / 100;
    return value.toLocaleString('pt-PT', {style: 'currency', currency: 'EUR'});
};

export const cartTotal = (items) =>
    items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
