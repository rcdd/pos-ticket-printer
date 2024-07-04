import React, {useEffect, useRef, useState} from 'react'
import MainLayout from '../layouts/MainLayout'
// import {toast} from 'react-toastify';
import LoadingButton from '@mui/lab/LoadingButton';
import {ComponentToPrint} from '../components/ComponentToPrint';
import Button from '@mui/material/Button';
import {Box, IconButton, InputAdornment} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import RecordService from "../services/record.service";

function POSPage() {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [changeValue, setChangeValue] = useState(0);
    const [openModal, setOpenModal] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);


    const formatterEUR = new Intl.NumberFormat('pt-PT', {
        maximumSignificantDigits: 2,
    });

    // const toastOptions = {
    //     autoClose: 400,
    //     pauseOnHover: true,
    // }

    const fetchProducts = async () => {
        setIsLoading(true);
        await ProductService.getAll().then((response) => {
            setProducts(response.data);
            setIsLoading(false);
        }).catch((error) => {
            throw Error(error.response.data.message)
        });
    }

    const addProductToCart = async (product) => {
        // check if the adding product exist
        let findProductInCart = await cart.find(i => {
            return i.id === product.id
        });

        if (findProductInCart) {
            let newCart = [];
            let newItem;

            cart.forEach(cartItem => {
                if (cartItem.id === product.id) {
                    newItem = {
                        ...cartItem,
                        quantity: cartItem.quantity + 1,
                        totalAmount: formatterEUR.format(cartItem.price) * (cartItem.quantity + 1)
                    }
                    newCart.push(newItem);
                } else {
                    newCart.push(cartItem);
                }
            });

            setCart(newCart);
        } else {
            let addingProduct = {
                ...product, 'quantity': 1, 'totalAmount': formatterEUR.format(product.price),
            }
            setCart([...cart, addingProduct]);
        }

    }

    const removeProduct = async (product) => {
        const newCart = cart.filter(cartItem => cartItem.id !== product.id);
        setCart(newCart);
    }

    const increaseQuantity = async (product) => {
        const newCart = cart.map(cartItem => {
            if (cartItem.id === product.id) {
                const quantity = cartItem.quantity + 1;
                cartItem.quantity = quantity;
                cartItem.totalAmount = formatterEUR.format(cartItem.price) * quantity
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
                cartItem.totalAmount = formatterEUR.format(cartItem.price) * quantity
                return cartItem;
            } else {
                return cartItem;
            }
        }).filter(cartItem => cartItem.quantity !== 0);

        setCart(newCart);
    }

    const componentRef = useRef();

    const handlePayment = () => {
        setOpenModal(true)
    }
    const handleCloseModal = async (status = false) => {
        if (status) {
            setIsPrinting(true);
            const bodyRequest = {
                items: [], cart: {items: cart, total: ((totalAmount / 100).toFixed(2))},
            };

            cart.forEach((cartItem) => {
                bodyRequest.items.push({
                    quantity: cartItem.quantity.toString(), name: cartItem.name, price: cartItem.price
                })
            });

            await PrinterService.print(bodyRequest);
            await RecordService.addRecord(bodyRequest.items)

            setCart([]);
            setTotalAmount(0);
            setChangeValue(0);
            setIsPrinting(false);
            setOpenModal(false);
        } else {
            setOpenModal(false);
        }
    };

    const doExchange = () => {
        const value = (changeValue - (totalAmount / 100)).toFixed(2);
        if (isNaN(value) || value < 0) {
            return '0.00€';
        }
        return value + '€';
    }

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        let newTotalAmount = 0;
        cart.forEach(icart => {
            newTotalAmount = parseFloat(newTotalAmount) + parseFloat(icart.totalAmount);
        })
        setTotalAmount(newTotalAmount);
    }, [cart])

    return (<MainLayout>
        <div className='row'>
            <div className='col-lg-7 products-list'>
                {isLoading ? 'Loading' : <div className='row'>
                    {products.map((product, key) => <div key={key} className='col-lg-4 mb-4'>
                        <div className='pos-item px-3 text-center border'
                             onClick={() => addProductToCart(product)}>
                            <p>{product.name}</p>
                            <img draggable="false" src={product.image} className="pos-item__image"
                                 alt={product.name}/>
                            <p>{(product.price / 100).toFixed(2)}€</p>
                        </div>
                    </div>)}
                </div>}

            </div>
            <div className='col-lg-5'>
                <div style={{display: "none"}}>
                    <ComponentToPrint cart={cart} totalAmount={totalAmount} ref={componentRef}/>
                </div>
                <div className='table-responsive-wrapper bg-dark'>
                    <table className='table table-responsive table-dark table-hover'>
                        <thead>
                        <tr>
                            <td width={123}>Quantidade</td>
                            <td width={150}>Item</td>
                            <td width={100}>Preço</td>
                            <td width={90}>Total</td>
                            <td></td>
                        </tr>
                        </thead>
                        <tbody className='products-table'>
                        {cart ? cart.map((cartProduct, key) => <tr key={key}>
                            <td width={123} align={"left"}>
                                <IconButton color="primary" aria-label="reduce quantity"
                                            onClick={() => decreaseQuantity(cartProduct)}>
                                    <RemoveIcon/>
                                </IconButton>
                                {cartProduct.quantity}
                                <IconButton color="primary" aria-label="increase quantity"
                                            onClick={() => increaseQuantity(cartProduct)}>
                                    <AddIcon/>
                                </IconButton>
                            </td>
                            <td width={150} valign={"middle"}>{cartProduct.name}</td>
                            <td width={100} valign={"middle"}>{(cartProduct.price / 100).toFixed(2)}€</td>
                            <td width={90} valign={"middle"}>{(cartProduct.totalAmount / 100).toFixed(2)}€</td>
                            <td align={"center"}>
                                <IconButton
                                    color="error"
                                    aria-label="delete"
                                    onClick={() => removeProduct(cartProduct)}>
                                    <DeleteIcon/>
                                </IconButton>
                            </td>
                        </tr>) : 'No Item in Cart'}
                        </tbody>
                    </table>
                </div>
                <h2 className='p-4 bg-dark text-white'>Total: {(totalAmount / 100).toFixed(2)}€</h2>

                <div className=''>
                    <Button variant="contained" fullWidth={true}
                            size="large" disabled={totalAmount === 0} onClick={handlePayment}>
                        Pagar
                    </Button>
                </div>


            </div>
        </div>
        <Dialog open={openModal} onClose={() => handleCloseModal(false)}
                fullWidth={true}
                maxWidth='sm'
        >
            <DialogTitle className='modal__title'>Pagamento</DialogTitle>
            <DialogContent>
                <Box
                    noValidate
                    component="form"
                    sx={{
                        display: 'flex', flexDirection: 'column', m: 'auto', width: 'fit-content',
                    }}
                >
                    <span className='modal__total'>Total: <b>{(totalAmount / 100).toFixed(2)}€</b></span>
                    <div className='modal__receive-value'>
                        <span>Valor recebido:</span>
                        <TextField
                            autoFocus
                            margin="dense"
                            type="amount"
                            variant="filled"
                            label={'Insira o valor recebido'}
                            fullWidth
                            defaultValue={(totalAmount / 100).toFixed(2)}
                            className={'modal__receive-value__input'}
                            onFocus={event => {
                                event.target.select();
                            }}
                            InputProps={{
                                endAdornment: <InputAdornment position="start">€</InputAdornment>,
                            }}
                            onChange={(value) => setChangeValue(value.target.value.replace(",", "."))}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleCloseModal(true);
                                }
                            }}
                        />
                    </div>
                    <span className='modal__exchange'>Troco: <b>{doExchange()}</b></span>
                </Box>
            </DialogContent>

            <DialogActions>
                <LoadingButton loading={isPrinting} loadingIndicator="A imprimir.."
                               variant="contained" fullWidth={true} size="large"
                               onClick={() => handleCloseModal(true)}>
                    Imprimir
                </LoadingButton>
            </DialogActions>
        </Dialog>
    </MainLayout>)
}

export default POSPage
