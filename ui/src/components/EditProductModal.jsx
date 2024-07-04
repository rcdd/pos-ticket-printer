import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, InputAdornment} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import ProductService from "../services/product.service";


function AddProductModal({open, close, product}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(product ? product.name : null);
    const [newPrice, setNewPrice] = useState(product ? product.price : 0);
    const [newImage, setNewImage] = useState(product ? product.image : null);

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const handleRemoveProduct = async () => {
        await ProductService.delete(product.id).then((response) => {
            console.log(response);
        }).catch(
            (error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
        );
        close(false);
    }
    const handleCloseModal = async (status: boolean = false) => {
        if (status) {
            const bodyRequest = {
                id: product.id,
                name: newName ?? product.name,
                price: newPrice ? newPrice * 100 : product.price,
                image: newImage ?? product.image,
            };

            await ProductService.update(bodyRequest).then((response) => {
                setNewName(null);
                setNewPrice(0);
                setNewImage(null);
                console.log(response);
            }).catch(
                (error) => {
                    console.log(error.response);
                    throw Error(error.response.data.message)
                }
            );

        }
        close(false);
    };
    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullWidth={true}
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Editar Produto</DialogTitle>
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
                        defaultValue={product ? product.name : null}
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
                        defaultValue={product ? (product.price / 100).toFixed(2) : 0}
                        InputProps={{
                            endAdornment: <InputAdornment position="start">€</InputAdornment>,
                        }}
                        onChange={(value) => setNewPrice(value.target.value)}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="image"
                        label="Imagem URL"
                        name="image"
                        autoComplete="image"
                        defaultValue={product ? product.image : null}
                        onChange={(value) => setNewImage(value.target.value)}
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button variant="contained" fullWidth={true} size="large" color="error"
                        onClick={handleRemoveProduct}>Remover</Button>
                <Button variant="contained" fullWidth={true} size="large"
                        onClick={() => handleCloseModal(true)}>Atualizar</Button>
            </DialogActions>
        </Dialog>
    )
}

export default AddProductModal
