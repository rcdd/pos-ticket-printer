import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LoadingButton from '@mui/lab/LoadingButton';

import ListProductComponent from '../../components/Admin/ListProductComponent';
import ProductModal from '../../components/Admin/ProductModal';
import ZoneModal from '../../components/Admin/ZoneModal';
import ProductService from '../../services/product.service';
import ZoneService from '../../services/zone.service';
import InventoryService from '../../services/inventory.service';
import {useToast} from "../../components/Common/ToastProvider";

const NO_ZONE_KEY = 'no-zone';

function ProductsPage() {
    const {pushNetworkError, pushMessage} = useToast();

    const [products, setProducts] = useState([]);
    const [zones, setZones] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState(NO_ZONE_KEY);
    const [isLoading, setIsLoading] = useState(true);

    const [openProductModal, setOpenProductModal] = useState(false);
    const [productEdit, setProductEdit] = useState(null);

    const [openZoneModal, setOpenZoneModal] = useState(false);
    const [zoneEdit, setZoneEdit] = useState(null);

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
            pushNetworkError(error, {title: 'Não foi possível obter as zonas'});
            return [];
        }
    }, [sortZones, pushNetworkError]);

    const fetchProducts = useCallback(async () => {
        try {
            const {data} = await ProductService.getAll();
            setProducts(data || []);
            return data || [];
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível obter os produtos'});
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
                setSelectedZoneId(zs.length > 0 ? String(zs[0].id) : NO_ZONE_KEY);
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [fetchZones, fetchProducts]);

    useEffect(() => {
        if (selectedZoneId === NO_ZONE_KEY) return;
        const exists = zones.some((z) => String(z.id) === String(selectedZoneId));
        if (!exists) {
            setSelectedZoneId(zones.length ? String(zones[0].id) : NO_ZONE_KEY);
        }
    }, [zones, selectedZoneId]);

    const productsByZone = useMemo(() => {
        const map = new Map();
        for (const zone of zones) {
            map.set(zone.id, products.filter((p) => p.zoneId === zone.id));
        }
        map.set(NO_ZONE_KEY, products.filter((p) => p.zoneId == null || zones.some(z => z.id === p.zoneId) === false));
        return map;
    }, [products, zones]);

    const totalProducts = products.length;
    const selectedZone = selectedZoneId === NO_ZONE_KEY
        ? null
        : zones.find((z) => String(z.id) === String(selectedZoneId)) || null;
    const selectedProducts = productsByZone.get(selectedZone?.id ?? NO_ZONE_KEY) || [];

    const handleAddProduct = useCallback(() => {
        setProductEdit(null);
        setOpenProductModal(true);
    }, []);

    const handleEditProduct = useCallback((product) => {
        setProductEdit(product);
        setOpenProductModal(true);
    }, []);

    const handleAddZone = useCallback(() => {
        setZoneEdit(null);
        setOpenZoneModal(true);
    }, []);

    const handleEditZone = useCallback((zone) => {
        setZoneEdit(zone);
        setOpenZoneModal(true);
    }, []);

    const onProductModalClose = useCallback(async (saved = false) => {
        setOpenProductModal(false);
        if (!saved) return;
        setIsLoading(true);
        try {
            await fetchProducts();
        } finally {
            setIsLoading(false);
        }
    }, [fetchProducts]);

    const onZoneModalClose = useCallback(async (saved = false) => {
        setOpenZoneModal(false);
        if (!saved) return;
        setIsLoading(true);
        try {
            const zs = await fetchZones();
            await fetchProducts();
            setSelectedZoneId(zs.length ? String(zs[0].id) : NO_ZONE_KEY);
        } finally {
            setIsLoading(false);
        }
    }, [fetchZones, fetchProducts]);

    const handleOrder = useCallback(async () => {
        await fetchProducts();
    }, [fetchProducts]);

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
                setSelectedZoneId(NO_ZONE_KEY);
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
    }, [confirmState, fetchProducts, fetchZones, pushMessage, pushNetworkError, closeConfirmDialog]);

    const zoneItems = useMemo(() => {
        const noZoneCount = productsByZone.get(NO_ZONE_KEY)?.length || 0;
        const items = zones.map((zone) => ({
            id: String(zone.id),
            name: zone.name,
            description: `${productsByZone.get(zone.id)?.length || 0} produtos`,
            count: productsByZone.get(zone.id)?.length || 0,
            raw: zone,
        }));

        if (noZoneCount > 0) {
            items.unshift({
                id: NO_ZONE_KEY,
                name: '(Sem Zona)',
                description: 'Produtos ainda sem uma zona atribuída.',
                count: noZoneCount,
            });
        }

        return items;
    }, [zones, productsByZone]);

    const confirmDialogTitle = confirmState.scope === 'zone'
        ? `Remover produtos da zona "${confirmState.zone?.name ?? ''}"?`
        : "Remover todas as zonas e produtos?";
    const confirmDialogDescription = confirmState.scope === 'zone'
        ? "Todos os produtos associados a esta zona serão removidos. Esta operação não pode ser anulada."
        : "Todos os produtos e zonas serão removidos. Esta operação não pode ser anulada.";

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 3}}>
            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                <Stack spacing={1}>
                    <Typography variant="h4" fontWeight={700}>Produtos</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Organize as zonas, reordene produtos por arrastar e largar e mantenha a grelha de POS sempre
                        atualizada.
                    </Typography>
                    <Stack direction={{xs: 'column', sm: 'row'}} spacing={1} sx={{mt: 1}}
                           alignItems={{xs: 'stretch', sm: 'center'}}>
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon/>}
                            onClick={handleAddZone}
                        >
                            Criar nova zona
                        </Button>
                        <Button variant="contained" startIcon={<LocalOfferIcon/>} onClick={handleAddProduct}
                                disabled={zones.length === 0}>
                            Adicionar produto
                        </Button>
                        <Tooltip title="Remove produtos sem afetar as zonas existentes">
                            <span>
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    startIcon={<CleaningServicesIcon/>}
                                    onClick={() => confirmRemoveZoneProducts(selectedZone)}
                                    disabled={!selectedZone || confirmState.loading || isLoading || selectedProducts.length === 0}
                                >
                                    Limpar produtos desta zona
                                </Button>
                            </span>
                        </Tooltip>
                        <Tooltip title="Remove todas as zonas e produtos. Utilize com cuidado.">
                            <span>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteSweepIcon/>}
                                    onClick={confirmRemoveAll}
                                    disabled={confirmState.loading || isLoading || (zones.length === 0 && totalProducts === 0)}
                                >
                                    Remover tudo
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Paper>

            <Box sx={{display: 'flex', flexDirection: {xs: 'column', md: 'row'}, gap: 3}}>
                <Paper
                    elevation={0}
                    sx={{
                        flexShrink: 0,
                        width: {xs: '100%', md: 240},
                        border: theme => `1px solid ${theme.palette.divider}`,
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{p: 2, pb: 1}}>
                        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                            Zonas
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Seleciona uma zona para gerir os respetivos produtos. Arrasta para reorganizar diretamente
                            na
                            lista à direita.
                        </Typography>
                    </Box>
                    <Divider/>
                    <List dense disablePadding>
                        {zoneItems.map((zoneItem) => (
                            <ListItem disablePadding key={zoneItem.id}>
                                <ListItemButton
                                    selected={String(selectedZoneId) === String(zoneItem.id)}
                                    onClick={() => setSelectedZoneId(zoneItem.id)}
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{bgcolor: 'primary.light', color: 'primary.dark'}}>
                                            {zoneItem.id === NO_ZONE_KEY ?
                                                <Inventory2Icon/> : zoneItem.name.slice(0, 2).toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    {zoneItem.name}
                                                </Typography>
                                                <Chip size="small" label={zoneItem.count}/>
                                            </Stack>
                                        }
                                        secondary={
                                            <Typography variant="caption" color="text.secondary">
                                                {zoneItem.id === NO_ZONE_KEY
                                                    ? 'Produtos sem zona'
                                                    : `${zoneItem.count} produto${zoneItem.count === 1 ? '' : 's'}`}
                                            </Typography>
                                        }
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                <Box sx={{flexGrow: 1, minHeight: 420, display: 'flex', flexDirection: 'column', gap: 2}}>
                    <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="h5" fontWeight={700}>
                                    {selectedZone ? selectedZone.name : 'Sem zona atribuída'}
                                </Typography>
                                {selectedZone && (
                                    <Button variant="text" onClick={() => handleEditZone(selectedZone)}>
                                        Editar zona
                                    </Button>
                                )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {selectedProducts.length > 0
                                    ? selectedZone ? 'Arraste um produto para alterar a ordem apresentada no POS.' : 'Edite os produtos para atribuir uma zona.'
                                    : 'Ainda não existem produtos nesta área.'}
                            </Typography>
                        </Stack>
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={{
                            flexGrow: 1,
                            border: theme => `1px solid ${theme.palette.divider}`,
                            minHeight: 280,
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {isLoading ? (
                            <Stack alignItems="center" justifyContent="center" sx={{flexGrow: 1, py: 6}}>
                                <CircularProgress/>
                                <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
                                    A carregar catálogo…
                                </Typography>
                            </Stack>
                        ) : selectedProducts.length === 0 ? (
                            <Stack alignItems="center" justifyContent="center" sx={{flexGrow: 1, py: 6, px: 3}}
                                   spacing={2}>
                                <Alert severity="info" sx={{maxWidth: 360, textAlign: 'center'}}>
                                    {zones.length === 0 ? 'Utilize "Criar Nova Zona" para começar a adicionar produto' : 'Utilize “Adicionar produto” para começar a preencher esta zona.'}
                                </Alert>
                            </Stack>
                        ) : (
                            <Box sx={{flexGrow: 1}}>
                                <ListProductComponent
                                    key={selectedZoneId}
                                    products={selectedProducts}
                                    editProduct={handleEditProduct}
                                    updateOrder={handleOrder}
                                />
                            </Box>
                        )}
                    </Paper>
                </Box>
            </Box>

            <Dialog
                open={confirmState.open}
                onClose={() => {
                    if (!confirmState.loading) closeConfirmDialog();
                }}
            >
                <DialogTitle>{confirmDialogTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{confirmDialogDescription}</DialogContentText>
                    {confirmState.scope === 'zone' && (
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            Zona selecionada: {confirmState.zone?.name}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeConfirmDialog} disabled={confirmState.loading}>
                        Cancelar
                    </Button>
                    <LoadingButton
                        color="error"
                        variant="contained"
                        onClick={handleConfirmRemoval}
                        loading={confirmState.loading}
                    >
                        Remover
                    </LoadingButton>
                </DialogActions>
            </Dialog>

            <ProductModal
                open={openProductModal}
                selectedZone={selectedZoneId}
                close={onProductModalClose}
                zones={zones}
                product={productEdit}
            />

            <ZoneModal
                open={openZoneModal}
                zone={zoneEdit}
                allZones={zones}
                close={onZoneModalClose}
            />
        </Box>
    );
}

export default ProductsPage;
