import React, {useEffect} from 'react'
import MainLayout from '../layouts/MainLayout'
import Button from "@mui/material/Button";
import AddProductModal from "../components/AddProductModal";
import ListProductComponent from "../components/ListProductComponent";
import EditProductModal from "../components/EditProductModal";
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import OptionService from "../services/option.service";


function SetupPage() {
    const [openAddModal, setOpenAddModal] = React.useState(false);
    const [openEditModal, setOpenEditModal] = React.useState(false);
    const [products, setProducts] = React.useState([]);
    const [productEdit, setProductEdit] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [printerList, setPrinterList] = React.useState([]);
    const [printer, setPrinter] = React.useState([]);

    useEffect(() => {
        getPrinterList().then(() => {
            fetchProducts().then(() => {
                OptionService.getPrinter().then((response) => {
                    setPrinter(response.data.name);
                }).catch((error) => {
                    console.log(error.response);
                }).finally(() => {
                    setIsLoading(false);
                });
            });
        });
    }, []);

    const fetchProducts = async () => {
        await ProductService.getAll().then((response) => {
            setProducts(response.data);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    };

    const handleEditProduct = (product) => {
        setProductEdit(product);
        setOpenEditModal(true);
    }

    const onAddProductModalClose = () => {
        setOpenAddModal(false);
        setIsLoading(true);
        fetchProducts().then(() => {
            setIsLoading(false);
        });
    }

    const onEditProductModalClose = () => {
        setOpenEditModal(false);
        setIsLoading(true);
        fetchProducts().then(() => {
            setIsLoading(false);
        });
    }

    const getPrinterList = async () => {
        PrinterService.getList().then((response) => {
            setPrinterList(response.data)
        });
    };

    const handlePrinterChange = (event) => {
        OptionService.setPrinter(event.target.value).then((response) => {
            setPrinter(event.target.value);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    return (<MainLayout>
        <div className='bg-light p-5 mt-4 rounded-3'>
            <h1>Setup</h1>
            {isLoading && <p>Loading...</p>}
            {!isLoading &&
                <div>
                    <div>
                        <h2>Produtos</h2>
                        <p>Adicione, edite ou remova produtos</p>
                        <Button variant="contained" fullWidth={false} size="large"
                                onClick={() => setOpenAddModal(true)}>
                            Adicionar Produto</Button>
                        <div style={{marginTop: "16px"}}>
                            <ListProductComponent products={products} editProduct={handleEditProduct}/>
                        </div>
                    </div>

                    <div>
                        <h2>Impressora</h2>
                        <FormControl fullWidth>
                            <InputLabel id="printer-select">Impressora</InputLabel>
                            <Select
                                labelId="printer-select"
                                id="printer-select"
                                value={printer}
                                label="Impressora"
                                defaultValue={printer}
                                onChange={handlePrinterChange}
                            >
                                {printerList.map((_printer) => {
                                    return (
                                        <MenuItem key={_printer.name} id={_printer.name} value={_printer.name}>{_printer.name}</MenuItem>)
                                })}
                            </Select>
                        </FormControl>
                    </div>
                </div>
            }
        </div>
        <AddProductModal open={openAddModal} close={onAddProductModalClose}/>
        <EditProductModal open={openEditModal} close={onEditProductModalClose} product={productEdit}/>
    </MainLayout>)
}

export default SetupPage
