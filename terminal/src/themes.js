// Mesmos temas de cor dos produtos usados na UI principal (CardThemes)
export const CARD_THEMES = {
    default: {background: '#f5f5f5', color: '#000'},
    blue: {background: '#1976d2', color: '#fff'},
    green: {background: '#2e7d32', color: '#fff'},
    orange: {background: '#ed6c02', color: '#fff'},
    red: {background: '#d32f2f', color: '#fff'},
    black: {background: '#000', color: '#fff'},
};

export const themeStyle = (theme) => {
    const t = CARD_THEMES[theme] ?? CARD_THEMES.default;
    return {background: t.background, color: t.color};
};
