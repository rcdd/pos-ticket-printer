import React, {useMemo} from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Button, Stack, Box
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';

export default function CartComponent({
                                          cart = [], setCart, totalAmount = 0,
                                          removeProduct, handlePayment,
                                      }) {
    const eur = useMemo(() => new Intl.NumberFormat('pt-PT', {style: 'currency', currency: 'EUR'}), []);

    const COLS = {
        qty: 64, price: 53, total: 56, actions: 37,
    };
    const fixedSum = COLS.qty + COLS.price + COLS.total + COLS.actions;


    const increaseQuantity = async (product) => {
        const newCart = cart.map(cartItem => {
            if (cartItem.id === product.id && cartItem.type === product.type) {
                const quantity = cartItem.quantity + 1;
                cartItem.quantity = quantity;
                cartItem.totalAmount = cartItem.price * quantity
                return cartItem;
            } else {
                return cartItem;
            }
        });

        setCart(newCart);
    }

    const decreaseQuantity = async (product) => {
        const newCart = cart.map(cartItem => {
            if (cartItem.id === product.id) {
                const quantity = cartItem.quantity - 1;
                cartItem.quantity = quantity;
                cartItem.totalAmount = cartItem.price * quantity
                return cartItem;
            } else {
                return cartItem;
            }
        }).filter(cartItem => cartItem.quantity !== 0);

        setCart(newCart);
    }

    return (<Box sx={{width: '100%'}}>
        <TableContainer
            component={Paper}
            sx={{
                height: 'calc(100vh - 190px)',
                overflow: 'auto',
                borderRadius: 2,
                boxShadow: '2px 2px 8px 4px rgba(0, 0, 0, 0.15)',
            }}
        >
            <Table
                stickyHeader
                size="small"
                aria-label="Carrinho"
                sx={{
                    tableLayout: 'fixed',
                    '& th, & td': {py: 0.5, px: 1, fontSize: 12, lineHeight: 2.5},
                    '& th': {fontWeight: 600, lineHeight: 2},
                }}
            >
                <colgroup>
                    <col style={{width: COLS.qty}}/>
                    <col style={{width: `calc(100% - ${fixedSum}px)`}}/>
                    <col style={{width: COLS.price}}/>
                    <col style={{width: COLS.total}}/>
                    <col style={{width: COLS.actions}}/>
                </colgroup>

                <TableHead>
                    <TableRow>
                        <TableCell align="center">Qt</TableCell>
                        <TableCell>Produto</TableCell>
                        <TableCell align="right">Preço</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell align="center"/>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {cart.length === 0 && (<TableRow>
                        <TableCell colSpan={5} align="center"
                                   sx={{fontSize: "16px!important", fontWeight: 700, opacity: 0.6}}>
                            Carrinho vazio
                        </TableCell>
                    </TableRow>)}

                    {cart.map((p) => (<TableRow key={p.id ?? `${p.name}-${p.price}`}>
                        {/* Qt */}
                        <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>
                            <Stack direction="row" alignItems="center" justifyContent="center">
                                <IconButton
                                    size="small"
                                    color="primary"
                                    sx={{p: 0.25}}
                                    aria-label={`Diminuir ${p.name}`}
                                    onClick={() => decreaseQuantity(p)}
                                    disabled={p.quantity <= 1}
                                >
                                    <RemoveIcon sx={{fontSize: 18}}/>
                                </IconButton>

                                <Box sx={{minWidth: 18, textAlign: 'center'}}>{p.quantity}</Box>

                                <IconButton
                                    size="small"
                                    color="primary"
                                    sx={{p: 0.25}}
                                    aria-label={`Aumentar ${p.name}`}
                                    onClick={() => increaseQuantity(p)}
                                >
                                    <AddIcon sx={{fontSize: 18}}/>
                                </IconButton>
                            </Stack>
                        </TableCell>

                        {/* Item */}
                        <TableCell
                            sx={{minWidth: 50, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            {p.name}
                        </TableCell>

                        {/* Preço */}
                        <TableCell align="left">{eur.format((p.price ?? 0) / 100)}</TableCell>

                        {/* Total linha */}
                        <TableCell align="left">
                            {eur.format(((p.totalAmount ?? p.price * p.quantity) || 0) / 100)}
                        </TableCell>

                        {/* Remover */}
                        <TableCell align="center">
                            <IconButton
                                color="error"
                                size="small"
                                sx={{p: 0.5}}
                                aria-label={`Remover ${p.name}`}
                                onClick={() => removeProduct(p)}
                            >
                                <DeleteIcon sx={{fontSize: 18}}/>
                            </IconButton>
                        </TableCell>
                    </TableRow>))}
                </TableBody>
            </Table>
        </TableContainer>

        <Box sx={{px: 1, mt: 1.25, display: 'flex', justifyContent: 'space-between'}}>
            <Box component="span" sx={{
                fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: 'text.secondary', alignSelf: 'flex-end'
            }}>
                Total
            </Box>
            <Box component="span" sx={{fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: 'primary.main'}}>
                {eur.format((totalAmount || 0) / 100)}
            </Box>
        </Box>

        <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{mt: 1.25}}
            disabled={!totalAmount}
            onClick={handlePayment}
        >
            PAGAR
        </Button>
    </Box>);
}
