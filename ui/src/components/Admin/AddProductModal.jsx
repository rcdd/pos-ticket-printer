import React, {useEffect, useState} from 'react'
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {Box, IconButton, InputAdornment, ListSubheader, OutlinedInput} from "@mui/material";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import ProductService from "../../services/product.service";
import {FileUploadOutlined} from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import MenuService from "../../services/menu.service";
import Chip from "@mui/material/Chip";
import ZoneService from "../../services/zone.service";


function AddProductModal({open, close, zone}) {
    const [openModal, setOpenModal] = React.useState(open);
    const [newName, setNewName] = useState(null);
    const [newPrice, setNewPrice] = useState(0);
    const [newImage, setNewImage] = useState(null);
    const [newProducts, setNewProducts] = useState([]);
    const [products, setProducts] = useState([]);
    const [newZone, setNewZone] = useState(null);
    const [zones, setZones] = useState(null);

    useEffect(() => {
        fetchZones().then(() => {
            ProductService.getAll().then((response) => {
                setNewZone(zone ?? null);
                setProducts(response.data);
            }).catch((error) => {
                console.log(error.response);
                throw Error(error.response.data.message)
            });
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }, [zone]);

    useEffect(() => {
        setOpenModal(open);
    }, [open]);

    const fetchZones = async () => {
        await ZoneService.getAll().then((response) => {
            setZones(response.data);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const handleCloseModal = async (status = false) => {
        if (status) {
            if (newZone === "Menu") {
                const bodyRequest = {
                    menu: {
                        name: newName,
                        price: newPrice.replace(",", ".") * 100
                    },
                    products: newProducts.map(p => p.id)
                }
                await MenuService.create(bodyRequest).then((response) => {
                    setNewName(null);
                    setNewPrice(0);
                    setNewProducts([]);
                });
            } else {
                const bodyRequest = {
                    name: newName,
                    price: newPrice > 0 ? newPrice.replace(",", ".") * 100 : 0,
                    image: newImage,
                    zoneId: newZone
                };

                await ProductService.create(bodyRequest).then((response) => {
                    setNewName(null);
                    setNewPrice(0);
                    setNewImage(null);
                    setNewZone(null);
                }).catch(
                    (error) => {
                        console.log(error.response);
                        throw Error(error.response.data.message)
                    }
                );
            }
        }
        close(false);
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        setNewImage("./imgs/" + file.name);
    };

    const handleTypeSelect = (event) => {
        setNewZone(event.target.value);
    }

    const handleChangeProducts = (event) => {
        const {
            target: {value},
        } = event;
        const select = value.at(-1);
        const product = products.find(p => p.id === select);
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
            <DialogTitle className='modal__title'>Novo Produto</DialogTitle>
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
                    <InputLabel id="type-select-label" required>Zona</InputLabel>
                    <Select
                        labelId="type-select-label"
                        id="type-select"
                        label="Zona"
                        value={newZone}
                        onChange={handleTypeSelect}
                    >
                        {zones && zones.map((zone) => (
                            <MenuItem key={zone.id} value={zone.id}>{zone.name}</MenuItem>
                        ))}
                        {/*<MenuItem value={"Menu"}>Menu</MenuItem>*/}
                    </Select>

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

                    {newZone === "Menu" ?
                        <Box>
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
                        : <TextField
                            margin="normal"
                            fullWidth
                            id="image"
                            label="Imagem"
                            name="image"
                            autoComplete="image"
                            value={newImage ?? ''}
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
                        />}
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
