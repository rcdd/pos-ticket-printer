import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton, InputAdornment, ListSubheader, MenuItem, OutlinedInput} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from '@mui/icons-material/Close';
import InputLabel from "@mui/material/InputLabel";
import MenuService from "../../services/menu.service";
import Select from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import ProductService from "../../services/product.service";


function EditMenuModal({open, close, menu}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(menu ? menu.name : null);
    const [newPrice, setNewPrice] = useState(menu ? menu.price : 0);
    const [newProducts, setNewProducts] = useState(menu ? menu.products : []);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        ProductService.getAll().then((response) => {
            setProducts(response.data);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }, []);

    useEffect(() => {
        setOpenModal(open);
        setNewName(null);
        setNewPrice(0);
        setNewProducts(menu ? menu.products : []);
    }, [open, menu]);

    const handleRemoveMenu = async () => {
        await MenuService.delete(menu.id).then((response) => {
            console.log(response);
        }).catch(
            (error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
        );
        close(false);
    }

    const handleCloseModal = async (status = false) => {
        if (status) {
            const productsArray = newProducts ?? menu.products;
            const productsIds = productsArray.map(p => p.id);
            const bodyRequest = {
                menu: {
                    name: newName ?? menu.name,
                    price: newPrice ? newPrice * 100 : menu.price,
                },
                products: productsIds,
            };

            await MenuService.update(menu.id, bodyRequest).then((response) => {
                console.log(response);
                setNewName(null);
                setNewPrice(0);
                setNewProducts([]);
            }).catch(
                (error) => {
                    console.log(error.response);
                    throw Error(error.response.data.message)
                }
            );


        }
        close(false);
    };

    const handleChangeProducts = (event) => {
        const {
            target: {value},
        } = event;
        var select = value.at(-1);
        var product = products.find(p => p.id === select);
        if (newProducts && newProducts.find(p => p.id === product.id)) {
            setNewProducts(newProducts.filter(p => p.id !== product.id));
        } else {
            setNewProducts([...newProducts, product]);
        }
    };

    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullWidth={true}
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Editar Menu</DialogTitle>
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
                    noValidate
                    component="form"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        m: 'auto',
                        width: 'fit-content',
                    }}
                >
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="name"
                        label="Nome"
                        name="name"
                        autoComplete="name"
                        autoFocus
                        defaultValue={menu ? menu.name : null}
                        onChange={(value) => setNewName(value.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="price"
                        label="Preço"
                        name="price"
                        autoComplete="price"
                        defaultValue={menu ? (menu.price / 100).toFixed(2) : 0}
                        InputProps={{
                            endAdornment: <InputAdornment position="start">€</InputAdornment>,
                        }}
                        onChange={(value) => setNewPrice(value.target.value)}
                    />

                    <InputLabel id="type-select-label">Produtos</InputLabel>
                    <Select
                        labelId="type-select-label-label"
                        id="type-select-label"
                        multiple
                        value={newProducts}
                        onChange={handleChangeProducts}
                        input={<OutlinedInput id="select-multiple-chip" label="Chip"/>}
                        renderValue={(selected) => (
                            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                                {selected.map((value) => (
                                    <Chip key={value.id} label={value.name}/>
                                ))}
                            </Box>
                        )}
                        MenuProps={{
                            PaperProps: {
                                style: {
                                    maxHeight: 48 * 4.5 + 8,
                                    width: 250,
                                },
                            },
                        }}
                    >
                        <ListSubheader>Bebidas</ListSubheader>
                        {products.filter(p => p.type === "Drink").map((product) => (
                            <MenuItem
                                key={product.id}
                                value={product.id}
                            >
                                {product.name}
                            </MenuItem>
                        ))}
                        <ListSubheader>Comidas</ListSubheader>
                        {products.filter(p => p.type === "Food").map((product) => (
                            <MenuItem
                                key={product.id}
                                value={product.id}
                            >
                                {product.name}
                            </MenuItem>
                        ))}
                    </Select>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button variant="contained" fullWidth={true} size="large" color="error"
                        onClick={handleRemoveMenu}>Remover</Button>
                <Button variant="contained" fullWidth={true} size="large"
                        onClick={() => handleCloseModal(true)}>Atualizar</Button>
            </DialogActions>
        </Dialog>
    )
}

export default EditMenuModal
