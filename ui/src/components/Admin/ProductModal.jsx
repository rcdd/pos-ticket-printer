import React, {useEffect, useMemo, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, CardActionArea, IconButton, InputAdornment, Typography,
    Button, MenuItem, InputLabel, Select
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ProductService from '../../services/product.service';
import {useToast} from "../Common/ToastProvider";
import {CardThemes} from "../../enums/CardThemes";
import NumericTextFieldWithKeypad from "../Common/NumericTextFieldKeypad";
import TextFieldKeyboard from "../Common/TextFieldKeyboard";

function ProductModal({open, close, selectedZone, zones = [], product = null}) {
    const {pushNetworkError} = useToast();

    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('0.00');
    const [newZoneId, setNewZoneId] = useState(selectedZone ?? null);
    const [newTheme, setNewTheme] = useState('default');

    useEffect(() => {
        if (!open) return;
        setNewName(product?.name ?? '');
        setNewPrice(
            product ? (product.price / 100).toFixed(2) : '0.00'
        );
        setNewZoneId(product?.zoneId ?? selectedZone ?? null);
        setNewTheme(product?.theme ?? 'default');
    }, [open, product, selectedZone]);

    const parsePriceToCents = (v) => {
        const num = parseFloat(String(v).replace(',', '.'));
        if (Number.isNaN(num) || num < 0) return 0;
        return Math.round(num * 100);
    };

    const isValid = useMemo(() => {
        return (newName?.trim().length ?? 0) > 0 && parsePriceToCents(newPrice) >= 0 && newZoneId !== null;
    }, [newName, newPrice, newZoneId]);

    const handleRemoveProduct = async () => {
        if (!product?.id) return close(false);
        try {
            await ProductService.delete(product.id);
        } catch (error) {
            pushNetworkError(error, {
                title: 'Não foi possivel remover o produto',
            });
            console.log(error?.response || error);
        } finally {
            close(true);
        }
    };

    const addProductRequest = async () => {
        const bodyRequest = {
            name: newName.trim(),
            price: parsePriceToCents(newPrice),
            zoneId: newZoneId,
            theme: newTheme,
        };
        try {
            await ProductService.create(bodyRequest);
            setNewName('');
            setNewPrice('0.00');
            setNewZoneId(selectedZone ?? null);
            setNewTheme('default');
        } catch (error) {
            pushNetworkError(error, {
                title: 'Não foi possivel adicionar o produto',
            });
            console.log(error?.response || error);
        } finally {
            close(true);
        }
    };

    const updateProductRequest = async () => {
        if (!product?.id) return;
        const bodyRequest = {
            id: product.id,
            name: newName.trim(),
            price: parsePriceToCents(newPrice),
            zoneId: newZoneId,
            theme: newTheme,
        };
        try {
            await ProductService.update(bodyRequest);
            setNewName('');
            setNewPrice('0.00');
            setNewZoneId(selectedZone ?? null);
            setNewTheme('default');
        } catch (error) {
            pushNetworkError(error, {
                title: 'Não foi possivel atualizar o produto',
            });
            console.log(error?.response || error);
        } finally {
            close(true);
        }
    };

    const handleCloseModal = async (submit = false, isUpdate = false) => {
        if (submit && isValid) {
            if (isUpdate) {
                await updateProductRequest();
            } else {
                await addProductRequest();
            }
        } else {
            close(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => handleCloseModal(false)}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle className="modal__title">
                {product ? 'Modificar' : 'Novo'} Produto
            </DialogTitle>

            <IconButton
                aria-label="close"
                onClick={() => handleCloseModal(false)}
                sx={(theme) => ({
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: theme.palette.grey[500],
                })}
            >
                <CloseIcon/>
            </IconButton>

            <DialogContent>
                <Box
                    component="form"
                    noValidate
                    sx={{display: 'flex', flexDirection: 'column', m: 'auto', width: 'fit-content'}}
                >
                    <InputLabel htmlFor="zone-select" required>Zona</InputLabel>
                    <Select
                        id="zone-select"
                        label="Zona"
                        value={newZoneId ?? ''}
                        onChange={(e) => setNewZoneId(e.target.value)}
                        variant="outlined"
                        displayEmpty
                        sx={{minWidth: 240}}
                    >
                        <MenuItem value="" disabled>Seleciona uma zona…</MenuItem>
                        {zones.map((zone) => (
                            <MenuItem key={zone.id} value={zone.id}>{zone.name}</MenuItem>
                        ))}
                    </Select>

                    <InputLabel htmlFor="name" sx={{mt: 2}} required>Nome</InputLabel>
                    <TextFieldKeyboard
                        value={newName}
                        onChange={setNewName}
                        textFieldProps={{
                            fullWidth: true,
                            autoComplete: "nome",
                            required: true,
                            helperText: `${newName?.length || 0}/20`,
                        }}
                        maxLength={20}
                        showSymbols={false}
                    />

                    <InputLabel htmlFor="price" sx={{mt: 2}} required>Preço</InputLabel>
                    <NumericTextFieldWithKeypad
                        required
                        fullWidth
                        decimal
                        id="price"
                        name="price"
                        autoComplete="off"
                        inputMode="decimal"
                        value={newPrice}
                        onChange={(v) => setNewPrice(v)}
                        InputProps={{
                            endAdornment: <InputAdornment position="end">€</InputAdornment>,
                        }}
                    />

                    <InputLabel htmlFor="theme" sx={{mt: 2}}>Tema</InputLabel>
                    <Box
                        id="theme"
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 2,
                            mt: 1,
                            mb: 2,
                        }}
                    >
                        {Object.keys(CardThemes).map((themeName) => (
                            <CardActionArea
                                key={themeName}
                                onClick={() => setNewTheme(themeName)}
                                data-active={newTheme === themeName ? '' : undefined}
                                sx={{
                                    px: 4,
                                    py: 2,
                                    fontSize: '14px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    outline: '1px solid',
                                    outlineColor: 'divider',
                                    '&[data-active]': {
                                        boxShadow: () => `0 0 0 2px black inset`,
                                        '&:hover': {backgroundColor: 'action.selectedHover'},
                                    },
                                    ...CardThemes[themeName],
                                }}
                            >
                                <Typography sx={{fontSize: '14px'}} noWrap><b>{themeName}</b></Typography>
                            </CardActionArea>
                        ))}
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions>
                {product && (
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        color="error"
                        onClick={handleRemoveProduct}
                    >
                        Remover
                    </Button>
                )}

                {product && (
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => handleCloseModal(true, true)}
                        disabled={!isValid}
                    >
                        Atualizar
                    </Button>
                )}

                {!product && (
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={() => handleCloseModal(true, false)}
                        disabled={!isValid}
                    >
                        Adicionar
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default ProductModal;
