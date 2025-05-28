import React, {useEffect, useState} from 'react'
import {PaymentModalComponent} from '../components/POS/PaymentModalComponent';
import {CartComponent} from '../components/POS/CartComponent';
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import InvoiceService from "../services/invoice.service";
import {ZoneSelectionComponent} from '../components/POS/ZoneSelectionComponent';
import MenuService from "../services/menu.service";

function POSPage() {
    const [productsFood, setProductsFood] = useState([]);
    const [productsDrink, setProductsDrink] = useState([]);
    const [menus, setMenus] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [invoiceId, setInvoiceId] = useState(null);
    const [totalAmount, setTotalAmount] = useState(0);
    const [changeValue, setChangeValue] = useState(0);
    const [openModal, setOpenModal] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [isPrinted, setIsPrinted] = React.useState(false);

    const fetchProducts = async () => {
        setIsLoading(true);
        await ProductService.getAll().then(async (response) => {
            const foods = [];
            const drinks = [];
            response.data.forEach(element => {
                if (element.image === null) {
                    element.image = "../imgs/placeholder.png"
                }

                if (element.type === 'Drink') {
                    drinks.push(element);
                }

                if (element.type === 'Food') {
                    foods.push(element);
                }
            });
            setProductsFood(foods);
            setProductsDrink(drinks);

            await MenuService.getAll().then((response) => {
                response.data.forEach(menu => {
                    menu.type = 'Menu';
                });

                setMenus(response.data);
                setIsLoading(false);
            });
        }).catch((error) => {
            throw Error(error.response.data.message)
        });
    }

    const addProductToCart = async (product) => {
        // check if the product to add already exists
        let itemExists = await cart.find(i => {
            return i.id === product.id && i.type === product.type;
        });

        if (itemExists) {
            let newCart = [];

            cart.forEach(cartItem => {
                if (cartItem.id === product.id && cartItem.type === product.type) {
                    let newItem = {
                        ...cartItem,
                        quantity: cartItem.quantity + 1,
                        totalAmount: cartItem.price * (cartItem.quantity + 1)
                    }
                    newCart.push(newItem);
                } else {
                    newCart.push(cartItem);
                }
            });

            setCart(newCart);
        } else {
            let addingProduct = {
                ...product, quantity: 1, totalAmount: product.price,
            }

            setCart([...cart, addingProduct]);
        }

    }

    const removeProduct = async (product) => {
        const newCart = cart.filter(cartItem => cartItem.id !== product.id || cartItem.type !== product.type);
        setCart(newCart);
    }

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

    const handlePayment = () => {
        setOpenModal(true)
    }

    const handlePrint = async (status = false) => {
        if (status) {
            setIsPrinted(false);
            setIsPrinting(true);

            const bodyRequest = {
                items: cart,
                totalAmount: (totalAmount / 100).toFixed(2),
            };

            await PrinterService.print(bodyRequest).catch((e) => {
                setIsPrinting(false);
                throw new Error(e.response.data);
            });

            setInvoiceId(await InvoiceService.addInvoice(bodyRequest.items, bodyRequest.totalAmount));

            setIsPrinting(false);
            setIsPrinted(true);
        } else {
            setOpenModal(false);
        }
    };

    const handleModalClose = () => {
        setOpenModal(false);

        if (isPrinted) {
            setCart([]);
            setTotalAmount(0);
            setChangeValue(0);
            setIsPrinted(false);
            setInvoiceId(null);
        }
    }

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        let newTotalAmount = 0;
        cart.forEach(cartItem => {
            newTotalAmount = parseFloat(newTotalAmount) + parseFloat(cartItem.totalAmount);
        })
        setTotalAmount(newTotalAmount);
    }, [cart])

    return (
        <div>
            <div className='row'>
                <ZoneSelectionComponent
                    isLoading={isLoading}
                    productsFood={productsFood}
                    productsDrink={productsDrink}
                    menus={menus}
                    addProductToCart={addProductToCart}/>

                <CartComponent
                    cart={cart}
                    totalAmount={totalAmount}
                    increaseQuantity={increaseQuantity}
                    decreaseQuantity={decreaseQuantity}
                    removeProduct={removeProduct}
                    handlePayment={handlePayment}/>
            </div>

            <PaymentModalComponent
                openModal={openModal}
                totalAmount={totalAmount}
                invoiceId={invoiceId}
                isPrinted={isPrinted}
                isPrinting={isPrinting}
                changeValue={changeValue}
                setChangeValue={setChangeValue}
                handlePrint={handlePrint}
                handleModalClose={handleModalClose}
            />
        </div>)
}

export default POSPage
