import React, {useEffect} from 'react'
import Button from "@mui/material/Button";
import AddProductModal from "../components/Admin/AddProductModal";
import ListProductComponent from "../components/Admin/ListProductComponent";
import EditProductModal from "../components/Admin/EditProductModal";
import ProductService from "../services/product.service";
import PrinterService from "../services/printer.service";
import {
    FormControl,
    InputLabel,
    TextField,
    MenuItem,
    Select,
    Box,
    Tab,
    IconButton
} from "@mui/material";
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import OptionService from "../services/option.service";
import MenuService from "../services/menu.service";
import EditMenuModal from "../components/Admin/EditMenuModal";
import ZoneService from "../services/zone.service";
import AddZoneModal from "../components/Admin/AddZoneModal";
import EditZoneModal from "../components/Admin/EditZoneModal";
import AddIcon from "@mui/icons-material/Add";

function SetupPage() {
    const [tabPosition, setTabPosition] = React.useState("1");
    const [tabProductsPosition, setTabProductsPosition] = React.useState("no-zone");
    const [openAddZoneModal, setOpenAddZoneModal] = React.useState(false);
    const [openAddProductModal, setOpenAddProductModal] = React.useState(false);
    const [openEditProductModal, setOpenEditProductModal] = React.useState(false);
    const [openEditZoneModal, setOpenEditZoneModal] = React.useState(false);
    const [openEditMenuModal, setOpenEditMenuModal] = React.useState(false);
    const [products, setProducts] = React.useState([]);
    const [productsMenus, setProductsMenus] = React.useState([]);
    const [productEdit, setProductEdit] = React.useState(null);
    const [zoneEdit, setZoneEdit] = React.useState(null);
    const [menuEdit, setMenuEdit] = React.useState(null);

    const [isLoading, setIsLoading] = React.useState(true);
    const [printerList, setPrinterList] = React.useState([]);
    const [printer, setPrinter] = React.useState([]);
    const [printType, setPrintType] = React.useState("totals");
    const [zone, setZone] = React.useState(null);
    const [zones, setZones] = React.useState(null);

    const [firstLine, setFirstLine] = React.useState();
    const [secondLine, setSecondLine] = React.useState();
    const [firstLineError, setFirstLineError] = React.useState(false);
    const [secondLineError, setSecondLineError] = React.useState(false);

    useEffect(() => {
        getPrinterList().then(() => {
            fetchZones().then(() => {
                fetchProducts().then(() => {
                    fetchMenus().then(() => {
                        OptionService.getPrinter().then((response) => {
                            setPrinter(response.data.name);
                            OptionService.getPrintType().then((response) => {
                                if (response.data) {
                                    setPrintType(response.data);
                                } else {
                                    setPrintType("totals"); // default value
                                }
                            })
                        }).catch((error) => {
                            console.log(error.response);
                        }).finally(() => {
                            setIsLoading(false);
                        });
                    });
                });
            });
        });

        OptionService.getHeaders().then(res => {
            setFirstLine(res.data.firstLine);
            setSecondLine(res.data.secondLine);
        });

    }, []);

    const fetchZones = async () => {
        await ZoneService.getAll().then((response) => {
            setZones(response.data.sort((a, b) => a.position > b.position ? 1 : -1));
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const fetchProducts = async () => {
        await ProductService.getAll().then((response) => {
            const products = [];

            response.data.forEach(element => {
                if (element.image === null) {
                    element.image = "../imgs/placeholder.png"
                }
                products.push(element);
            });

            setProducts(products);
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

    const handleEditZone = (zone) => {
        setZoneEdit(zone);
        setOpenEditZoneModal(true);
    }

    const handleEditMenu = (menu) => {
        setMenuEdit(menu);
        setOpenEditMenuModal(true);
    }

    const onAddProductModalClose = () => {
        setOpenAddProductModal(false);
        setIsLoading(true);
        fetchProducts().then(() => {
            fetchMenus().then(() => {
                setIsLoading(false);
            });
        });
    }

    const onAddZoneModalClose = () => {
        setOpenAddZoneModal(false);
        setIsLoading(true);
        fetchZones().then(() => {
            fetchProducts().then(() => {
                fetchMenus().then(() => {
                    setIsLoading(false);
                });
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

    const handleOrder = () => {
        fetchProducts().then(() => {
        });
    }

    const onEditMenuModalClose = () => {
        setOpenEditMenuModal(false);
        setIsLoading(true);
        fetchMenus().then(() => {
            setIsLoading(false);
        });
    }


    const onEditZoneModalClose = () => {
        setOpenEditZoneModal(false);
        setIsLoading(true);
        fetchZones().then(() => {
            setIsLoading(false);
        });
    }

    const getPrinterList = async () => {
        PrinterService.getList().then((response) => {
            setPrinterList(response.data)
        });
    };

    const handlePrinterChange = (event) => {
        OptionService.setPrinter(event.target.value).then(() => {
            setPrinter(event.target.value);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const handlePrintTypeChange = (event) => {
        OptionService.setPrintType(event.target.value).then(() => {
            setPrintType(event.target.value);
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
        OptionService.setHeaderFirstLine(event.target.value).then(() => {
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
        OptionService.setHeaderSecondLine(event.target.value).then(() => {
            setSecondLine(event.target.value);
        }).catch((error) => {
            console.log(error.response);
            throw Error(error.response.data.message)
        });
    }

    const handleTabChange = (event, newValue) => {
        setTabPosition(newValue);
    };

    const handleTabProductsChange = (event, newValue) => {
        setTabProductsPosition(newValue);
        setZone(newValue);
    }

    return (<div>
        <h1 className={"mb-4"}>Configurações</h1>
        {isLoading && <p>Loading...</p>}
        {!isLoading && <div>
            <TabContext value={tabPosition}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <TabList onChange={handleTabChange} aria-label="lab API tabs example">
                        <Tab label="Produtos" value="1"/>
                        <Tab label="Impressora" value="2"/>
                    </TabList>
                </Box>

                <TabPanel value="1">
                    <h2>Produtos</h2>
                    <p>Adicione, edite ou remova produtos</p>
                    <Button variant="contained" fullWidth={false} size="large"
                            onClick={() => setOpenAddProductModal(true)}>
                        Adicionar Produto</Button>

                    <TabContext value={tabProductsPosition}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <TabList onChange={handleTabProductsChange} aria-label="lab API tabs example">
                                {products.filter(p => p.zoneId === null || !zones.some(z => z.id === p.zoneId))
                                    .length > 0 && <Tab key="no-zone" label="(Sem Zona)" value="no-zone"/>}

                                {zones && zones.map((zone) => (
                                    <Tab key={zone.id} label={zone.name} value={zone.id}/>
                                ))}

                                <IconButton
                                    aria-label="add"
                                    onClick={() => setOpenAddZoneModal(true)}>
                                    <AddIcon/>
                                </IconButton>
                            </TabList>
                        </Box>
                        <TabPanel key="0" value="no-zone">
                            <ListProductComponent products={products.filter(p => p.zoneId === null || !zones.some(z => z.id === p.zoneId))}
                                                  editProduct={handleEditProduct}
                                                  updateOrder={handleOrder}/>
                        </TabPanel>
                        {zones && zones.map((zone) => (
                            <TabPanel key={zone.id} value={zone.id}>
                                <Button variant="contained" fullWidth={false} size="large"
                                        onClick={() => handleEditZone(zone)}>
                                    Editar Zona</Button>
                                <ListProductComponent products={products.filter(p => p.zoneId === zone.id)}
                                                      editProduct={handleEditProduct}
                                                      updateOrder={handleOrder}/>
                            </TabPanel>
                        ))}
                    </TabContext>
                </TabPanel>

                <TabPanel value="2">
                    <div style={{marginBottom: "32px"}}>
                        <h3>Impressora</h3>
                        <FormControl fullWidth>
                            <InputLabel id="printer-select">Impressora</InputLabel>
                            <Select
                                labelId="printer-select"
                                id="printer-select"
                                value={printer ?? ""}
                                label="Impressora"
                                variant="outlined"
                                defaultValue={printer}
                                onChange={handlePrinterChange}
                                style={{marginBottom: "8px"}}
                            >
                                {printerList.map((_printer) => {
                                    return (<MenuItem key={_printer.name} id={_printer.name}
                                                      value={_printer.name}>{_printer.name}</MenuItem>)
                                })}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth>
                            <InputLabel id="print-type-select">Tipo de Impressão</InputLabel>
                            <Select
                                labelId="print-type-select"
                                id="print-type-select"
                                value={printType ?? "totals"}
                                label="Tipo de Impressão"
                                variant="outlined"
                                defaultValue={printType}
                                onChange={handlePrintTypeChange}
                            >
                                <MenuItem key="totals" id="totals"
                                          value="totals">Totais</MenuItem>

                                <MenuItem key="tickets" id="tickets"
                                          value="tickets">Individuais</MenuItem>

                                <MenuItem key="both" id="both"
                                          value="both">Ambos</MenuItem>
                            </Select>

                            <h2 className="mt-16"><br/></h2>

                            <h2>Cabeçalho</h2>
                            <TextField error={firstLineError} id="firstLine" label="Primeira Linha"
                                       variant="outlined" defaultValue={firstLine} style={{marginBottom: "8px"}}
                                       onChange={handlerHeaderFirstLine}/>
                            <TextField error={secondLineError} id="secondLine" label="Segunda Linha"
                                       variant="outlined" defaultValue={secondLine}
                                       onChange={handlerHeaderSecondLine}/>
                        </FormControl>
                    </div>

                </TabPanel>
            </TabContext>
        </div>}
        <AddProductModal open={openAddProductModal} zone={zone} close={onAddProductModalClose}/>
        <EditProductModal open={openEditProductModal} close={onEditProductModalClose} product={productEdit}/>
        <EditMenuModal open={openEditMenuModal} close={onEditMenuModalClose} menu={menuEdit}/>
        <AddZoneModal open={openAddZoneModal} zone={zone} close={onAddZoneModalClose}/>
        <EditZoneModal open={openEditZoneModal} close={onEditZoneModalClose} zone={zoneEdit}/>
    </div>)
}

export default SetupPage
