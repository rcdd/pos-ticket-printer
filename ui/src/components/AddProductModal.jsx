import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, InputAdornment} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import ProductService from "../services/product.service";


function AddProductModal({open, close}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(null);
    const [newPrice, setNewPrice] = useState(0);
    const [newImage, setNewImage] = useState(null);

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const handleCloseModal = async (status: boolean = false) => {
        if (status) {
            const bodyRequest = {
                name: newName,
                price: newPrice.replace(",", ".") * 100,
                image: newImage,
            };

            await ProductService.create(bodyRequest).then((response) => {
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
            <DialogTitle className='modal__title'>Novo Produto</DialogTitle>
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
                        InputProps={{
                            endAdornment: <InputAdornment position="start">€</InputAdornment>,
                        }}
                        onChange={(value) => setNewPrice(value.target.value)}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="image"
                        label="Imagem"
                        name="image"
                        autoComplete="image"
                        onChange={(value) => setNewImage(value.target.value)}
                    />
                </Box>
            </DialogContent>

            <DialogActions>
                <Button variant="contained" fullWidth={true} size="large"
                        onClick={() => handleCloseModal(true)}>Adicionar</Button>
            </DialogActions>
        </Dialog>
    )
}

export default AddProductModal
