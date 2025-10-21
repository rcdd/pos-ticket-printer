import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Button from '@mui/material/Button';
import ListProductComponent from '../../components/Admin/ListProductComponent';
import ProductService from '../../services/product.service';
import InventoryService from '../../services/inventory.service';
import {
    Box,
    Tab,
    IconButton,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Typography
} from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import ZoneService from '../../services/zone.service';
import AddIcon from '@mui/icons-material/Add';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ProductModal from '../../components/Admin/ProductModal';
import ZoneModal from '../../components/Admin/ZoneModal';
import LoadingButton from '@mui/lab/LoadingButton';
import {useToast} from "../../components/Common/ToastProvider";

function ProductsPage() {
    const [tabProductsPosition, setTabProductsPosition] = useState('no-zone');
    const [openAddEditZoneModal, setOpenAddEditZoneModal] = useState(false);
    const [openAddEditProductModal, setOpenAddEditProductModal] = useState(false);

    const {pushNetworkError, pushMessage} = useToast();

    const [products, setProducts] = useState([]);
    const [productEdit, setProductEdit] = useState(null);

    const [zoneEdit, setZoneEdit] = useState(null);
    const [zones, setZones] = useState([]);

    const [isLoading, setIsLoading] = useState(true);
    const [confirmState, setConfirmState] = useState({open: false, scope: null, zone: null, loading: false});

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

    const confirmRemoveZoneProducts = useCallback((zone) => {
        setConfirmState({open: true, scope: 'zone', zone, loading: false});
    }, []);

    const confirmRemoveAll = useCallback(() => {
        setConfirmState({open: true, scope: 'all', zone: null, loading: false});
    }, []);

    const closeConfirmDialog = useCallback(() => {
        setConfirmState({open: false, scope: null, zone: null, loading: false});
    }, []);

    const handleConfirmRemoval = useCallback(async () => {
        if (!confirmState.scope) {
            closeConfirmDialog();
            return;
        }

        setConfirmState((prev) => ({...prev, loading: true}));
        setIsLoading(true);

        try {
            if (confirmState.scope === 'zone' && confirmState.zone) {
                await ProductService.deleteByZone(confirmState.zone.id);
                await fetchProducts();
                pushMessage("success", `Produtos da zona "${confirmState.zone.name}" removidos.`);
            } else if (confirmState.scope === 'all') {
                await InventoryService.resetAll();
                await fetchZones();
                await fetchProducts();
                setTabProductsPosition('no-zone');
                pushMessage("success", "Todos os produtos e zonas foram removidos.");
            }
        } catch (error) {
            const title = confirmState.scope === 'all'
                ? 'Não foi possível remover produtos e zonas'
                : 'Não foi possível remover os produtos da zona';
            pushNetworkError(error, {title});
        } finally {
            setIsLoading(false);
            setConfirmState({open: false, scope: null, zone: null, loading: false});
        }
    }, [confirmState, fetchProducts, fetchZones, pushMessage, pushNetworkError]);

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

    const isZoneScope = confirmState.scope === 'zone';
    const confirmDialogTitle = isZoneScope
        ? `Remover produtos da zona "${confirmState.zone?.name ?? ''}"?`
        : "Remover todas as zonas e produtos?";
    const confirmDialogDescription = isZoneScope
        ? "Todos os produtos associados a esta zona serão removidos. Esta operação não pode ser anulada."
        : "Todos os produtos e zonas serão removidos. Esta operação não pode ser anulada.";

    return (
        <div>
            {isLoading && <p>Loading...</p>}
            {!isLoading && (
                <div>
                    <h2>Produtos</h2>
                    <p>Adicione, edite ou remova produtos</p>
                    <Stack
                        direction={{xs: 'column', sm: 'row'}}
                        spacing={1}
                        alignItems={{xs: 'stretch', sm: 'center'}}
                        sx={{mb: 2}}
                    >
                        <Button variant="contained" size="large" onClick={handleAddProduct}>
                            Adicionar Produto
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteSweepIcon/>}
                            onClick={confirmRemoveAll}
                            disabled={confirmState.loading || isLoading || (zones.length === 0 && products.length === 0)}
                        >
                            Remover tudo (zonas e produtos)
                        </Button>
                    </Stack>

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
                                <Stack
                                    direction={{xs: 'column', sm: 'row'}}
                                    spacing={1}
                                    sx={{mb: 2}}
                                    alignItems={{xs: 'stretch', sm: 'center'}}
                                >
                                    <Button
                                        variant="contained"
                                        size="medium"
                                        onClick={() => handleEditZone(zone)}
                                    >
                                        Editar Zona
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CleaningServicesIcon/>}
                                        onClick={() => confirmRemoveZoneProducts(zone)}
                                        disabled={confirmState.loading || isLoading}
                                    >
                                        Remover produtos da zona
                                    </Button>
                                </Stack>
                                <ListProductComponent
                                    products={productsByZone(zone.id)}
                                    editProduct={handleEditProduct}
                                    updateOrder={handleOrder}
                                />
                            </TabPanel>
                        ))}
                    </TabContext>

                    <Dialog
                        open={confirmState.open}
                        onClose={() => {
                            if (!confirmState.loading) closeConfirmDialog();
                        }}
                    >
                        <DialogTitle>{confirmDialogTitle}</DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                {confirmDialogDescription}
                            </DialogContentText>
                            {isZoneScope && (
                                <Typography variant="body2" color="text.secondary">
                                    Zona: {confirmState.zone?.name}
                                </Typography>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeConfirmDialog} disabled={confirmState.loading}>
                                Cancelar
                            </Button>
                            <LoadingButton
                                color="error"
                                onClick={handleConfirmRemoval}
                                loading={confirmState.loading}
                                variant="contained"
                            >
                                Remover
                            </LoadingButton>
                        </DialogActions>
                    </Dialog>

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
