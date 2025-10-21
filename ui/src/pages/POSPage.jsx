import React, {useEffect, useState} from 'react'
import {PaymentModalComponent} from '../components/POS/PaymentModalComponent';
import CartComponent from '../components/POS/CartComponent';
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import InvoiceService from "../services/invoice.service";
import {ZoneSelectionComponent} from '../components/POS/ZoneSelectionComponent';
import MenuService from "../services/menu.service";
import ZoneService from "../services/zone.service";
import {useToast} from "../components/Common/ToastProvider";
import {Backdrop, InputAdornment, Box, Paper, Typography, Button} from "@mui/material";
import InputLabel from "@mui/material/InputLabel";
import SessionService from "../services/session.service";
import NumericTextFieldWithKeypad from "../components/Common/NumericTextFieldKeypad";
import LoadingButton from '@mui/lab/LoadingButton';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import {useSession} from "../context/SessionContext.jsx";

function POSPage({user}) {
    const {session, setSession} = useSession();
    const {pushNetworkError} = useToast();
    const [products, setProducts] = useState([]);
    const [zones, setZones] = useState([]);
    const [menus, setMenus] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [cart, setCart] = useState([]);
    const [invoiceId, setInvoiceId] = useState(null);
    const [openModal, setOpenModal] = React.useState(false);
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [isPrinted, setIsPrinted] = React.useState(false);
    const [initialCashValue, setInitialCashValue] = React.useState(0);

    const handleInitSession = async () => {
        const num = parseFloat(String(initialCashValue).replace(',', '.'));
        const value = Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : 0;

        if (!user?.id) {
            pushNetworkError(null, {
                title: 'Utilizador não autenticado',
                message: 'Efetue login para iniciar a sessão de caixa.',
            });
            return;
        }

        const sessionData = {userId: user.id, initialAmount: value, notes: null};

        setIsLoading(true);
        try {
            const res = await SessionService.start(sessionData);
            setSession(res.data);
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível iniciar a sessão'});
            console.error(error?.response?.data || error);
        } finally {
            setIsLoading(false);
        }
    };

    const addProductToCart = (product) => {
        setCart((prev) => {
            const idx = prev.findIndex(i => i.id === product.id && i.type === product.type);
            if (idx >= 0) {
                const copy = [...prev];
                const item = copy[idx];
                const quantity = item.quantity + 1;
                copy[idx] = {...item, quantity, totalAmount: item.price * quantity};
                return copy;
            }
            return [...prev, {...product, quantity: 1, totalAmount: product.price}];
        });
    };

    const removeProduct = (product) => {
        setCart((prev) => prev.filter(
            i => !(i.id === product.id && i.type === product.type)
        ));
    };

    const handlePayment = () => {
        if (cart.length === 0 || !user?.id || !session?.id) return;
        setOpenModal(true);
    };

    const handlePrint = async (status = false, finalAmount = totalAmount, discount = 0, paymentMethod, openDrawer) => {
        if (!status) {
            setOpenModal(false);
            return;
        }

        if (!session?.id) {
            pushNetworkError(null, {
                title: 'Sessão indisponível',
                message: 'Inicie ou recupere a sessão de caixa antes de finalizar o pagamento.',
            });
            setOpenModal(false);
            return;
        }

        try {
            setIsPrinted(false);
            setIsPrinting(true);

            const printPayload = {
                items: cart,
                totalAmount: (finalAmount / 100).toFixed(2),
                openDrawer: openDrawer
            };
            await PrinterService.printTicket(printPayload);

            const invoiceId = await InvoiceService.addInvoice(
                session.id,
                user?.id,
                cart,
                finalAmount,
                discount,
                paymentMethod
            );

            setInvoiceId(invoiceId);
            setIsPrinted(true);
        } catch (e) {
            pushNetworkError(e, {title: 'Não foi possivel finalizar o pagamento.'});
            console.error(e?.response?.data || e);
            setIsPrinted(false);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleModalClose = () => {
        setOpenModal(false);

        if (isPrinted) {
            setCart([]);
            setIsPrinted(false);
            setInvoiceId(null);
        }
    }

    useEffect(() => {
        let mounted = true;

        if (!user?.id) {
            setProducts([]);
            setZones([]);
            setMenus([]);
            setIsLoading(false);
            return () => {
                mounted = false;
            };
        }

        (async () => {
            setIsLoading(true);
            try {
                const [zonesRes, productsRes, menusRes] = await Promise.all([
                    ZoneService.getAll(),
                    ProductService.getAll(),
                    MenuService.getAll(),
                ]);

                if (!mounted) return;

                const zonesSorted = (zonesRes.data || []).sort((a, b) => a.position - b.position);
                setZones(zonesSorted);

                setProducts(productsRes.data || []);

                const menus = (menusRes.data || []).map(m => ({...m, type: 'Menu'}));
                setMenus(menus);
            } catch (error) {
                if (!mounted) return;
                pushNetworkError(error, {title: 'Não foi possível carregar dados'});
                console.error(error?.response?.data || error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [pushNetworkError, user?.id]);


    const totalAmount = React.useMemo(
        () => cart.reduce((acc, it) => acc + (it.totalAmount || 0), 0),
        [cart]
    );

    return (
        <>
            <div className='row'>
                <div className='products-wrapper col-xl-8 col-lg-8 col-md-6'>
                    <ZoneSelectionComponent
                        isLoading={isLoading}
                        zones={zones}
                        products={products}
                        menus={menus}
                        addProductToCart={addProductToCart}/>
                </div>
                <div className='col-xl-4 col-lg-4 col-md-6 cart-wrapper'>
                    <CartComponent
                        cart={cart}
                        setCart={setCart}
                        totalAmount={totalAmount}
                        removeProduct={removeProduct}
                        handlePayment={handlePayment}/>
                </div>
            </div>

            <PaymentModalComponent
                openModal={openModal}
                totalAmount={totalAmount}
                invoiceId={invoiceId}
                isPrinted={isPrinted}
                isPrinting={isPrinting}
                handlePrint={handlePrint}
                handleModalClose={handleModalClose}
            />

            <Backdrop
                open={Boolean(user?.id) && !session}
                sx={(theme) => ({
                    zIndex: theme.zIndex.appBar - 1,
                    bgcolor: 'rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(8px)',
                    p: 2,
                })}
            >
                <Paper
                    elevation={6}
                    sx={{
                        width: 'min(420px, 92vw)',
                        p: 3,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                        <PointOfSaleIcon fontSize="large" color="primary"/>
                        <Typography variant="h6" component="h2" sx={{mb: 0}}>
                            Sem sessão iniciada
                        </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                        Para começar, indique o <b>valor inicial</b> em caixa.
                    </Typography>

                    <InputLabel id="initial-cash-label">Valor inicial de caixa</InputLabel>
                    <NumericTextFieldWithKeypad
                        value={initialCashValue}
                        onChange={(v) => setInitialCashValue(v)}
                        decimal
                        maxLength={9}
                        textFieldProps={{
                            id: 'initial-cash',
                            placeholder: '0,00',
                            fullWidth: true,
                            InputProps: {endAdornment: <InputAdornment position="end">€</InputAdornment>},
                        }}
                    />

                    <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1}}>
                        <Button variant="outlined" onClick={() => setInitialCashValue('0,00')}>
                            €0
                        </Button>
                        <Button variant="outlined" onClick={() => setInitialCashValue('20,00')}>
                            €20
                        </Button>
                        <Button variant="outlined" onClick={() => setInitialCashValue('50,00')}>
                            €50
                        </Button>
                        <Button variant="outlined" onClick={() => setInitialCashValue('100,00')}>
                            €100
                        </Button>
                    </Box>

                    <LoadingButton
                        loading={isLoading}
                        variant="contained"
                        size="large"
                        onClick={handleInitSession}
                        sx={{mt: 0.5}}
                    >
                        Começar
                    </LoadingButton>
                </Paper>
            </Backdrop>
        </>)
}

export default POSPage
