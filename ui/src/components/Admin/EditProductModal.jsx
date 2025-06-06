import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton, InputAdornment} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import CloseIcon from '@mui/icons-material/Close';
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import ProductService from "../../services/product.service";
import {FileUploadOutlined} from "@mui/icons-material";


function EditProductModal({open, close, product}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(product ? product.name : null);
    const [newPrice, setNewPrice] = useState(product ? product.price : 0);
    const [newImage, setNewImage] = useState(product ? product.image : null);
    const [newType, setNewType] = useState(product ? product.type : null);

    useEffect(() => {
        setOpenModal(open);
        setNewName(null);
        setNewPrice(0);
        setNewImage(null);
        setNewType(null);
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

    const handleCloseModal = async (status = false) => {
        if (status) {
            const bodyRequest = {
                id: product.id,
                name: newName ?? product.name,
                price: newPrice ? newPrice * 100 : product.price,
                image: newImage ?? product.image,
                type: newType ?? product.type
            };

            await ProductService.update(bodyRequest).then((response) => {
                console.log(response);
                setNewName(null);
                setNewPrice(0);
                setNewImage(null);
                setNewType(null);
            }).catch(
                (error) => {
                    console.log(error.response);
                    throw Error(error.response.data.message)
                }
            );


        }
        close(false);
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        setNewImage("./imgs/" + file.name);
    };

    const handleTypeSelect = (event) => {
        console.log(event);
        setNewType(event.target.value);
    }

    return (
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullWidth={true}
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Editar Produto</DialogTitle>
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
                    <InputLabel id="type-select-label">Tipo</InputLabel>
                    <Select
                        labelId="type-select-label"
                        id="type-select"
                        value={newType ? newType : product ? product.type : null}
                        label="Tipo"
                        variant="outlined"
                        onChange={handleTypeSelect}
                    >
                        <MenuItem value={"Drink"}>Bebida</MenuItem>
                        <MenuItem value={"Food"}>Comida</MenuItem>
                    </Select>

                    <TextField
                        margin="normal"
                        fullWidth
                        id="image"
                        label="Imagem URL"
                        name="image"
                        autoComplete="image"
                        defaultValue={newImage ? newImage : product ? product.image : null}
                        InputProps={{
                            endAdornment: (
                                <IconButton component="label">
                                    <FileUploadOutlined/>
                                    <input
                                        type="file"
                                        hidden
                                        onChange={handleUpload}
                                    />
                                </IconButton>
                            ),
                        }}
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

export default EditProductModal
