import React, {useEffect} from 'react'
import Button from "@mui/material/Button";
import AddProductModal from "../components/Admin/AddProductModal";
import ListProductComponent from "../components/Admin/ListProductComponent";
import EditProductModal from "../components/Admin/EditProductModal";
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import {FormControl, InputLabel, TextField, MenuItem, Select, Box, Tab} from "@mui/material";
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import OptionService from "../services/option.service";
import MenuService from "../services/menu.service";
import ListMenuComponent from "../components/Admin/ListMenuComponent";
import EditMenuModal from "../components/Admin/EditMenuModal";

function SetupPage() {
    const [tabPosition, setTabPosition] = React.useState("1");
    const [openAddModal, setOpenAddModal] = React.useState(false);
    const [openEditProductModal, setOpenEditProductModal] = React.useState(false);
    const [openEditMenuModal, setOpenEditMenuModal] = React.useState(false);
    const [productsDrinks, setProductsDrinks] = React.useState([]);
    const [productsFoods, setProductsFoods] = React.useState([]);
    const [productsMenus, setProductsMenus] = React.useState([]);
    const [productEdit, setProductEdit] = React.useState(null);
    const [menuEdit, setMenuEdit] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [printerList, setPrinterList] = React.useState([]);
    const [printer, setPrinter] = React.useState([]);
    const [zone, setZone] = React.useState([]);

    const [firstLine, setFirstLine] = React.useState();
    const [secondLine, setSecondLine] = React.useState();
    const [firstLineError, setFirstLineError] = React.useState(false);
    const [secondLineError, setSecondLineError] = React.useState(false);

    useEffect(() => {
        getPrinterList().then(() => {
            fetchProducts().then(() => {
                fetchMenus().then(() => {
                    OptionService.getPrinter().then((response) => {
                        setPrinter(response.data.name);
                    }).catch((error) => {
                        console.log(error.response);
                    }).finally(() => {
                        setIsLoading(false);
                    });
                });
            });
        });

        OptionService.getHeaders().then(res => {
            setFirstLine(res.data.firstLine);
            setSecondLine(res.data.secondLine);
        });

    }, []);

    const fetchProducts = async () => {
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

            setProductsFoods(foods);
            setProductsDrinks(drinks);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    };

    const fetchMenus = async () => {
        await MenuService.getAll().then((response) => {
            setProductsMenus(response.data);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    };

    const handleEditProduct = (product) => {
        setProductEdit(product);
        setOpenEditProductModal(true);
    }

    const handleEditMenu = (menu) => {
        setMenuEdit(menu);
        setOpenEditMenuModal(true);
    }

    const onAddProductModalClose = () => {
        setOpenAddModal(false);
        setIsLoading(true);
        fetchProducts().then(() => {
            fetchMenus().then(() => {
                setIsLoading(false);
            });
        });
    }

    const onEditProductModalClose = () => {
        setOpenEditProductModal(false);
        setIsLoading(true);
        fetchProducts().then(() => {
            setIsLoading(false);
        });
    }

    const onEditMenuModalClose = () => {
        setOpenEditMenuModal(false);
        setIsLoading(true);
        fetchMenus().then(() => {
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

    const handlerHeaderFirstLine = (event) => {
        if (event.target.value.length === 0 || event.target.value.length > 40) {
            setFirstLineError(true);
            return;
        }

        setFirstLineError(false);
        OptionService.setHeaderFirstLine(event.target.value).then((response) => {
            setFirstLine(event.target.value);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const handlerHeaderSecondLine = (event) => {
        if (event.target.value.length > 40) {
            setSecondLineError(true);
            return;
        }

        setSecondLineError(false);
        OptionService.setHeaderSecondLine(event.target.value).then((response) => {
            setSecondLine(event.target.value);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const handleTabChange = (event, newValue) => {
        setTabPosition(newValue);
    };

    return (
        <div>
            <h1 className={"mb-4"}>Configurações</h1>
            {isLoading && <p>Loading...</p>}
            {!isLoading &&
                <div>
                    <TabContext value={tabPosition}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <TabList onChange={handleTabChange} aria-label="lab API tabs example">
                                <Tab label="Produtos" value="1"/>
                                <Tab label="Impressora" value="2"/>
                                <Tab label="Cabeçalhos" value="3"/>
                            </TabList>
                        </Box>
                        <TabPanel value="1">
                            <h2>Produtos</h2>
                            <p>Adicione, edite ou remova produtos</p>
                            <Button variant="contained" fullWidth={false} size="large"
                                    onClick={() => setOpenAddModal(true)}>
                                Adicionar Produto</Button>
                            <div style={{marginTop: "16px"}}>
                                {
                                    zone !== null ?
                                        <div style={{display: "flex", alignItems: "center"}} className='mb-3'>
                                            <div className='pos-item py-3 px-5' onClick={() => setZone(null)}>🔙
                                                Retroceder
                                            </div>
                                            <h3 className='p-1 px-5 text-center'>{zone === 'food' ? "Comidas" : zone === "menu" ? "Menus" : "Bebidas"}</h3>
                                        </div>
                                        : null
                                }

                                {
                                    zone === 'food' ? <ListProductComponent products={productsFoods}
                                                                            editProduct={handleEditProduct}/> :
                                        zone === 'drink' ? <ListProductComponent products={productsDrinks}
                                                                                 editProduct={handleEditProduct}/> :
                                            zone === 'menu' ? <ListMenuComponent menus={productsMenus}
                                                                                 editMenu={handleEditMenu}/> :
                                                <div className='mb-5'>
                                                    <div className='pos-item mt-5 mb-3 py-2 text-center border'
                                                         onClick={() => setZone('food')}>
                                                        <p>Comidas</p>
                                                        <img draggable="false" src="../imgs/restaurant-icon.png"
                                                             className="pos-item__image"
                                                             alt=""/>
                                                    </div>
                                                    <div className='pos-item mb-3 py-2 text-center border'
                                                         onClick={() => setZone('drink')}>
                                                        <p>Bebidas</p>
                                                        <img draggable="false" src="../imgs/bar-icon.png"
                                                             className="pos-item__image"
                                                             alt=""/>
                                                    </div>
                                                    <div className='pos-item py-2 text-center border'
                                                         onClick={() => setZone('menu')}>
                                                        <p>Combinados</p>
                                                        <img draggable="false" src="../imgs/combi.png"
                                                             className="pos-item__image"
                                                             alt=""/>
                                                    </div>
                                                </div>
                                }
                            </div>
                        </TabPanel>

                        <TabPanel value="2">
                            <div style={{marginBottom: "32px"}}>
                                <h2>Impressora</h2>
                                <FormControl fullWidth>
                                    <InputLabel id="printer-select">Impressora</InputLabel>
                                    <Select
                                        labelId="printer-select"
                                        id="printer-select"
                                        value={printer ?? ""}
                                        label="Impressora"
                                        defaultValue={printer}
                                        onChange={handlePrinterChange}
                                    >
                                        {printerList.map((_printer) => {
                                            return (
                                                <MenuItem key={_printer.name} id={_printer.name}
                                                          value={_printer.name}>{_printer.name}</MenuItem>)
                                        })}
                                    </Select>
                                </FormControl>
                            </div>

                        </TabPanel>
                        <TabPanel value="3">
                            <h2>Cabeçalho</h2>
                            <FormControl fullWidth>
                                <TextField error={firstLineError} id="firstLine" label="Primeira Linha"
                                           variant="standard" defaultValue={firstLine}
                                           onChange={handlerHeaderFirstLine}/>
                                <TextField error={secondLineError} id="secondLine" label="Segunda Linha"
                                           variant="standard" defaultValue={secondLine}
                                           onChange={handlerHeaderSecondLine}/>
                            </FormControl>
                        </TabPanel>
                    </TabContext>
                </div>
            }
            <AddProductModal open={openAddModal} zone={zone} close={onAddProductModalClose}/>
            <EditProductModal open={openEditProductModal} close={onEditProductModalClose} product={productEdit}/>
            <EditMenuModal open={openEditMenuModal} close={onEditMenuModalClose} menu={menuEdit}/>
        </div>
    )
}

export default SetupPage
