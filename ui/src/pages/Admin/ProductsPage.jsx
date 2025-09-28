import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Button from '@mui/material/Button';
import ListProductComponent from '../../components/Admin/ListProductComponent';
import ProductService from '../../services/product.service';
import {Box, Tab, IconButton} from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import ZoneService from '../../services/zone.service';
import AddIcon from '@mui/icons-material/Add';
import ProductModal from '../../components/Admin/ProductModal';
import ZoneModal from '../../components/Admin/ZoneModal';
import {useToast} from "../../components/Common/ToastProvider";

function ProductsPage() {
    const [tabProductsPosition, setTabProductsPosition] = useState('no-zone');
    const [openAddEditZoneModal, setOpenAddEditZoneModal] = useState(false);
    const [openAddEditProductModal, setOpenAddEditProductModal] = useState(false);

    const {pushNetworkError} = useToast();

    const [products, setProducts] = useState([]);
    const [productEdit, setProductEdit] = useState(null);

    const [zoneEdit, setZoneEdit] = useState(null);
    const [zones, setZones] = useState([]);

    const [isLoading, setIsLoading] = useState(true);

    const sortZones = useCallback(
        (arr) => [...arr].sort((a, b) => (a.position > b.position ? 1 : -1)),
        []
    );

    const fetchZones = useCallback(async () => {
        try {
            const {data} = await ZoneService.getAll();
            const sorted = sortZones(data || []);
            setZones(sorted);
            return sorted;
        } catch (error) {
            pushNetworkError(error, {
                title: 'Não foi possivel obter as zonas',
            });
            console.log(error?.response || error);
            return [];
        }
    }, [sortZones, pushNetworkError]);

    const fetchProducts = useCallback(async () => {
        try {
            const {data} = await ProductService.getAll();
            setProducts(data || []);
            return data || [];
        } catch (error) {
            pushNetworkError(error, {
                title: 'Não foi possivel obter os produtos',
            });
            console.log(error?.response || error);
            return [];
        }
    }, [pushNetworkError]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setIsLoading(true);
            try {
                const [zs] = await Promise.all([fetchZones(), fetchProducts()]);
                if (!mounted) return;
                setTabProductsPosition(zs.length > 0 ? String(zs[0].id) : 'no-zone');
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [fetchZones, fetchProducts]);

    useEffect(() => {
        const currentIsValid =
            tabProductsPosition === 'no-zone' ||
            zones.some((z) => String(z.id) === String(tabProductsPosition));
        if (!currentIsValid) {
            setTabProductsPosition(zones.length ? String(zones[0].id) : 'no-zone');
        }
    }, [zones, tabProductsPosition]);

    const productsNoZone = useMemo(() => {
        if (!zones?.length) {
            return products.filter((p) => p.zoneId == null);
        }
        return products.filter(
            (p) => p.zoneId == null || !zones.some((z) => z.id === p.zoneId)
        );
    }, [products, zones]);

    const productsByZone = useCallback(
        (zoneId) => products.filter((p) => p.zoneId === zoneId),
        [products]
    );

    const handleAddProduct = useCallback(() => {
        setProductEdit(null);
        setOpenAddEditProductModal(true);
    }, []);

    const handleEditProduct = useCallback((product) => {
        setProductEdit(product);
        setOpenAddEditProductModal(true);
    }, []);

    const handleAddZone = useCallback(() => {
        setZoneEdit(null);
        setOpenAddEditZoneModal(true);
    }, []);


    const handleEditZone = useCallback((zone) => {
        setZoneEdit(zone);
        setOpenAddEditZoneModal(true);
    }, []);

    const onProductModalClose = useCallback(
        async (isOk = false) => {
            setOpenAddEditProductModal(false);
            if (!isOk) return;
            setIsLoading(true);
            try {
                await fetchProducts();
            } finally {
                setIsLoading(false);
            }
        },
        [fetchProducts]
    );

    const onZoneModalClose = useCallback(
        async (isOk = false) => {
            setOpenAddEditZoneModal(false);
            if (!isOk) return;
            setIsLoading(true);
            try {
                const zs = await fetchZones();
                await fetchProducts();
                setTabProductsPosition(zs.length ? String(zs[0].id) : 'no-zone');
            } finally {
                setIsLoading(false);
            }
        },
        [fetchZones, fetchProducts]
    );

    const handleOrder = useCallback(async () => {
        await fetchProducts();
    }, [fetchProducts]);

    const handleTabProductsChange = useCallback((event, newValue) => {
        setTabProductsPosition(newValue);
    }, []);

    return (
        <div>
            {isLoading && <p>Loading...</p>}
            {!isLoading && (
                <div>
                    <h2>Produtos</h2>
                    <p>Adicione, edite ou remova produtos</p>
                    <Button variant="contained" size="large" onClick={handleAddProduct}>
                        Adicionar Produto
                    </Button>

                    <TabContext value={tabProductsPosition}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                borderBottom: 1,
                                borderColor: 'divider',
                                mt: 2,
                            }}
                        >
                            <TabList onChange={handleTabProductsChange} aria-label="Zonas">
                                {productsNoZone.length > 0 && (
                                    <Tab key="no-zone" label="(Sem Zona)" value="no-zone"/>
                                )}
                                {zones.map((z) => (
                                    <Tab key={z.id} label={z.name} value={String(z.id)}/>
                                ))}
                            </TabList>

                            <IconButton aria-label="add" onClick={handleAddZone} sx={{ml: 1}}>
                                <AddIcon/>
                            </IconButton>
                        </Box>

                        <TabPanel key="no-zone" value="no-zone">
                            <ListProductComponent
                                products={productsNoZone}
                                editProduct={handleEditProduct}
                                updateOrder={handleOrder}
                            />
                        </TabPanel>

                        {zones.map((zone) => (
                            <TabPanel key={zone.id} value={String(zone.id)}>
                                <Button
                                    variant="contained"
                                    size="medium"
                                    onClick={() => handleEditZone(zone)}
                                    sx={{mb: 2}}
                                >
                                    Editar Zona
                                </Button>
                                <ListProductComponent
                                    products={productsByZone(zone.id)}
                                    editProduct={handleEditProduct}
                                    updateOrder={handleOrder}
                                />
                            </TabPanel>
                        ))}
                    </TabContext>

                    <ProductModal
                        open={openAddEditProductModal}
                        selectedZone={tabProductsPosition}
                        close={onProductModalClose}
                        zones={zones}
                        product={productEdit}
                    />

                    <ZoneModal
                        open={openAddEditZoneModal}
                        zone={zoneEdit}
                        allZones={zones}
                        close={onZoneModalClose}
                    />
                </div>
            )}
        </div>
    );
}

export default ProductsPage;
