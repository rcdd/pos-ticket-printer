import React, { useEffect, useState } from 'react'
import MainLayout from '../layouts/MainLayout'
import { PaymentModalComponent } from '../components/POS/PaymentModalComponent';
import { CartComponent } from '../components/POS/CartComponent';
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import InvoiceService from "../services/invoice.service";
import { ZoneSelectionComponent } from '../components/POS/ZoneSelectionComponent';

function POSPage() {
    const [productsFood, setProductsFood] = useState([]);
    const [productsDrink, setProductsDrink] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [invoiceId, setInvoiceId] = useState(null);
    const [totalAmount, setTotalAmount] = useState(0);
    const [changeValue, setChangeValue] = useState(0);
    const [openModal, setOpenModal] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [isPrinted, setIsPrinted] = React.useState(false);
    const [zone, setZone] = React.useState(null);

    const formatterEUR = new Intl.NumberFormat('pt-PT', {
        maximumSignificantDigits: 2,
    });

    const fetchProducts = async () => {
        setIsLoading(true);
        await ProductService.getAll().then((response) => {
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
                ...product, quantity: 1, totalAmount: formatterEUR.format(product.price),
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

    const handlePayment = () => {
        setOpenModal(true)
    }

    const handlePrint = async (status = false, totals = false) => {
        if (status) {
            setIsPrinted(false);
            setIsPrinting(true);
            const bodyRequest = {
                items: cart,
                totalAmount: (totalAmount / 100).toFixed(2),
                totalOnly: totals,
            };

            await PrinterService.print(bodyRequest);
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
            setZone(null);
            setInvoiceId(null);
        }
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
            <ZoneSelectionComponent
                zone={zone}
                setZone={setZone}
                isLoading={isLoading}
                productsFood={productsFood}
                productsDrink={productsDrink}
                addProductToCart={addProductToCart} />

            <CartComponent
                cart={cart}
                totalAmount={totalAmount}
                increaseQuantity={increaseQuantity}
                decreaseQuantity={decreaseQuantity}
                removeProduct={removeProduct}
                handlePayment={handlePayment} />
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
    </MainLayout>)
}

export default POSPage
