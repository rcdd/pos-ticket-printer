import React, {useEffect} from 'react'
import {
    Box,
    Tab,
    Stack,
    Paper,
    Typography,
    TextField,
    CircularProgress,
} from "@mui/material";
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import PrinterPage from "./PrinterPage";
import OptionService from "../../services/option.service";
import LoadingButton from "@mui/lab/LoadingButton";
import Switch from "@mui/material/Switch";
import {useVirtualKeyboard} from "../../context/VirtualKeyboardContext.jsx";

function SetupPage() {
    const [tabPosition, setTabPosition] = React.useState("1");
    const [favoritesEnabled, setFavoritesEnabled] = React.useState(false);
    const [favoritesCount, setFavoritesCount] = React.useState(6);
    const [favoritesSaving, setFavoritesSaving] = React.useState(false);
    const [favoritesLoaded, setFavoritesLoaded] = React.useState(false);
    const {enabled: virtualKeyboardEnabled, setEnabled: setVirtualKeyboardEnabled, loading: virtualKeyboardLoading} = useVirtualKeyboard();
    const [keyboardSaving, setKeyboardSaving] = React.useState(false);

    const handleTabChange = (event, newValue) => {
        setTabPosition(newValue);
    };

    useEffect(() => {
        let mounted = true;
        OptionService.getFavoritesSettings()
            .then(({data}) => {
                if (!mounted) return;
                setFavoritesEnabled(Boolean(data?.enabled));
                setFavoritesCount(Number(data?.count) || 6);
            })
            .catch(() => {
                if (!mounted) return;
                setFavoritesEnabled(false);
                setFavoritesCount(6);
            })
            .finally(() => {
                if (mounted) setFavoritesLoaded(true);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const handleSaveFavorites = async (event) => {
        event.preventDefault();
        setFavoritesSaving(true);
        try {
            const payload = {
                enabled: favoritesEnabled,
                count: Math.max(1, Math.min(12, Number(favoritesCount) || 6)),
            };
            await OptionService.saveFavoritesSettings(payload);
            setFavoritesCount(payload.count);
        } catch (error) {
            console.error("Failed to save favorites settings", error?.response?.data || error);
        } finally {
            setFavoritesSaving(false);
        }
    };

    const handleToggleVirtualKeyboard = async (event) => {
        const nextValue = event.target.checked;
        const previous = virtualKeyboardEnabled;
        setVirtualKeyboardEnabled(nextValue);
        setKeyboardSaving(true);
        try {
            await OptionService.setVirtualKeyboard(nextValue);
        } catch (error) {
            console.error("Failed to save virtual keyboard setting", error?.response?.data || error);
            setVirtualKeyboardEnabled(previous);
        } finally {
            setKeyboardSaving(false);
        }
    };

    return (
        <div>
            <h1 className={"mb-4"}>Configurações</h1>
            <div>
                <TabContext value={tabPosition}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                        <TabList onChange={handleTabChange} aria-label="lab API tabs example">
                            <Tab label="Impressora" value="1"/>
                            <Tab label="Programa" value="2"/>
                        </TabList>
                    </Box>

                    <TabPanel value="1">
                        <PrinterPage/>
                    </TabPanel>

                    <TabPanel value="2">
                        <Stack spacing={3}>
                            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                                <Typography variant="h6" fontWeight={700} gutterBottom>
                                    Teclado Virtual
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                                    Ativa ou desativa o teclado virtual para os campos numéricos e de texto. A
                                    configuração é partilhada entre todos os utilizadores deste terminal.
                                </Typography>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Switch
                                        checked={virtualKeyboardEnabled}
                                        onChange={handleToggleVirtualKeyboard}
                                        disabled={virtualKeyboardLoading || keyboardSaving}
                                    />
                                    <Typography variant="body2">
                                        {virtualKeyboardEnabled ? 'Teclado virtual ativado' : 'Teclado virtual desativado'}
                                    </Typography>
                                    {(virtualKeyboardLoading || keyboardSaving) && (
                                        <CircularProgress size={18}/>
                                    )}
                                </Stack>
                            </Paper>

                            <Paper elevation={0} sx={{p: 3, border: theme => `1px solid ${theme.palette.divider}`}}>
                                <Typography variant="h6" fontWeight={700} gutterBottom>
                                    Favoritos no POS
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                                    Mostra uma aba dedicada aos produtos mais vendidos diretamente no POS para acesso
                                    rápido.
                                </Typography>

                                {!favoritesLoaded ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <CircularProgress size={20}/>
                                        <Typography variant="body2">A carregar configurações…</Typography>
                                    </Stack>
                                ) : (
                                    <Box component="form" onSubmit={handleSaveFavorites} sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                        <Stack direction="row" spacing={2} alignItems="center">
                                            <Switch
                                                checked={favoritesEnabled}
                                                onChange={(e) => setFavoritesEnabled(e.target.checked)}
                                            />
                                            <Typography variant="body2">
                                                {favoritesEnabled ? 'Favoritos ativados' : 'Favoritos desativados'}
                                            </Typography>
                                        </Stack>

                                        <TextField
                                            label="Quantidade de favoritos"
                                            type="number"
                                            inputProps={{min: 1, max: 12}}
                                            value={favoritesCount}
                                            onChange={(e) => setFavoritesCount(e.target.value)}
                                            disabled={!favoritesEnabled}
                                            sx={{width: {xs: '100%', sm: 200}}}
                                        />

                                        <LoadingButton variant="contained" type="submit" loading={favoritesSaving}>
                                            Guardar
                                        </LoadingButton>
                                    </Box>
                                )}
                            </Paper>
                        </Stack>
                    </TabPanel>
                </TabContext>
            </div>
        </div>
    )
}

export default SetupPage
