import {Box, Card, Chip, Stack, Typography} from "@mui/material";
import {keyframes} from "@mui/material/styles";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import React, {useEffect, useState} from "react";
import {CardThemes} from "../../enums/CardThemes";

const formatPrice = (cents) => `${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')} €`;

const wiggle = keyframes`
    0%, 100% { transform: rotate(-0.6deg); }
    50% { transform: rotate(0.6deg); }
`;

// The product button, the same in the POS grid and in Configurações →
// Produtos: name, unit price and, for bundle products, how many tickets
// (senhas) it prints. sorting/dragging are the admin reorder states;
// showPrice follows the "Preços no POS" option (always on in Configurações).
export function ProductComponent({item, onClick, showPrice = true, sorting = false, dragging = false}) {
    const themeStyles = CardThemes[item.theme] ?? CardThemes.default;
    const tickets = item.ticketsPerUnit > 1 ? item.ticketsPerUnit : 0;

    const [windowsWidth, setWindowsWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowsWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const compact = windowsWidth < 1200;

    return (
        <Card
            variant="outlined"
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: compact ? 1.5 : 2,
                minHeight: compact ? 60 : 90,
                borderRadius: 2,
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                cursor: sorting ? 'grab' : 'pointer',
                ...themeStyles,
                transition: 'transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
                ...(sorting && !dragging && {
                    animation: `${wiggle} 0.35s ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {animation: 'none'},
                    outline: '2px dashed',
                    outlineColor: 'divider',
                    outlineOffset: -2,
                }),
                ...(dragging && {
                    transform: 'scale(1.05)',
                    boxShadow: 8,
                    cursor: 'grabbing',
                }),
                '&:active': dragging || sorting ? {} : {transform: 'scale(0.99)', boxShadow: 1},
                overflow: 'hidden',
            }}
        >
            {sorting && <DragIndicatorIcon sx={{opacity: 0.7, flexShrink: 0}}/>}
            <Box sx={{minWidth: 0, flexGrow: 1, textAlign: sorting ? 'left' : 'center'}}>
                <Typography sx={{fontSize: compact ? '14px' : '22px', fontWeight: 700, lineHeight: 1.2}} noWrap>
                    {item.name}
                </Typography>
                {showPrice && (
                    <Stack direction="row" spacing={0.75} alignItems="center"
                           justifyContent={sorting ? 'flex-start' : 'center'} sx={{mt: 0.5}}>
                        <Typography sx={{fontSize: compact ? '13px' : '17px', opacity: 0.85, flexShrink: 0}} noWrap>
                            {formatPrice(item.price)}
                        </Typography>
                        {tickets > 0 && (
                            <Chip size="small" label={`${tickets} senhas`}
                                  sx={{height: 20, minWidth: 0, fontSize: '11px', bgcolor: 'rgba(0,0,0,0.12)', color: 'inherit'}}/>
                        )}
                    </Stack>
                )}
            </Box>
        </Card>
    );
}
