import React from 'react'
import {Routes, Route, useLocation, useNavigate, Navigate} from 'react-router-dom'
import {styled, useTheme} from "@mui/material/styles";
import MuiAppBar from "@mui/material/AppBar";
import CssBaseline from "@mui/material/CssBaseline";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import InfoIcon from '@mui/icons-material/Info';
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import HomeIcon from "@mui/icons-material/Home";
import ListItemText from "@mui/material/ListItemText";
import SettingsIcon from "@mui/icons-material/Settings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SetupPage from "./Admin/SetupPage";
import ReportsPage from "./Admin/ReportsPage";
import Box from "@mui/material/Box";
import POSPage from "./POSPage";
import AboutPage from "./AboutPage";
import LoginModal from "../components/Admin/LoginModal";
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import SessionService from "../services/session.service";
import SessionPage from "./Admin/SessionPage";
import ImportExportPage from "./Admin/ImportExportPage";
import ImportExportIcon from '@mui/icons-material/ImportExport';
import CategoryIcon from '@mui/icons-material/Category';
import ProductsPage from "./Admin/ProductsPage";
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Backdrop from "@mui/material/Backdrop";
import Paper from "@mui/material/Paper";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import UsersPage from "./Admin/UsersPage";
import InitialUserSetup from "../components/Admin/InitialUserSetup";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Alert from "@mui/material/Alert";
import AuthService from "../services/auth.service";
import UserService from "../services/user.service";
import OptionService from "../services/option.service";
import LicenseModal from "../components/Admin/LicenseModal.jsx";
import LicenseService from "../services/license.service.js";
import LicensePage from "./Admin/LicensePage.jsx";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {SessionProvider} from "../context/SessionContext.jsx";

const drawerWidth = 240;

const Main = styled('main', {shouldForwardProp: (prop) => prop !== 'open'})(({theme}) => ({
    flexGrow: 1,
    padding: theme.spacing(2),
}));

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open' && prop !== 'alert',
})(({theme, alert}) => ({
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: alert ? theme.palette.error.dark : undefined,
    color: alert ? theme.palette.getContrastText(theme.palette.error.dark) : undefined,
    transition: theme.transitions.create(['background-color'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.shortest,
    }),
}));

const DrawerHeader = styled('div')(({theme}) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

function HomePage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = React.useState(false);
    const [loginModal, setLoginModal] = React.useState(false);
    const [login, setLogin] = React.useState(false);
    const [openCloseModal, setOpenCloseModal] = React.useState(false);
    const [session, setSession] = React.useState(null);
    const [sessionLoading, setSessionLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState(() => AuthService.getUser());
    const [adminMode, setAdminMode] = React.useState(false);
    const [moreAnchor, setMoreAnchor] = React.useState(null);
    const moreOpen = Boolean(moreAnchor);
    const openMore = (e) => setMoreAnchor(e.currentTarget);
    const closeMore = () => setMoreAnchor(null);

    const [checkingLicense, setCheckingLicense] = React.useState(true);
    const [licenseInfo, setLicenseInfo] = React.useState(null);
    const [licenseModalOpen, setLicenseModalOpen] = React.useState(false);

    const [checkingUsers, setCheckingUsers] = React.useState(true);
    const [requireUserSetup, setRequireUserSetup] = React.useState(false);
    const licenseValid = Boolean(licenseInfo?.valid);
    const [shouldAutoPromptLogin, setShouldAutoPromptLogin] = React.useState(false);
    const showLockScreen = !login && !requireUserSetup && !checkingUsers && !checkingLicense;

    const refreshSession = React.useCallback(async () => {
        if (!licenseValid || !login || !AuthService.isAuthenticated()) {
            setSession(null);
            setSessionLoading(false);
            return;
        }

        setSessionLoading(true);
        try {
            const response = await SessionService.getActiveSession();
            setSession(response.data);
        } catch (error) {
            if (error?.response && error.response.status !== 404) {
                console.log(error.response);
            }
            setSession(null);
        } finally {
            setSessionLoading(false);
        }
    }, [licenseValid, login]);

    const loadLicenseStatus = React.useCallback(async () => {
        setCheckingLicense(true);
        try {
            const {data} = await LicenseService.getStatus();
            setLicenseInfo(data);
            setLicenseModalOpen(!data?.valid);
            setShouldAutoPromptLogin(false);
        } catch (error) {
            console.error("Erro ao verificar licença:", error?.response || error);
            const fallback = {
                valid: false,
                status: 'error',
                message: 'Não foi possível validar a licença. Volte a tentar.',
            };
            setLicenseInfo(fallback);
            setLicenseModalOpen(true);
            setShouldAutoPromptLogin(false);
        } finally {
            setCheckingLicense(false);
        }
    }, []);

    const checkOnboardingStatus = React.useCallback(async () => {
        setCheckingUsers(true);
        try {
            const {data} = await OptionService.getOnboardingStatus();
            const needsSetup = !(data?.completed);
            setRequireUserSetup(needsSetup);
            return needsSetup;
        } catch (error) {
            console.error("Erro ao verificar estado de onboarding:", error?.response || error);
            setRequireUserSetup(false);
            return false;
        } finally {
            setCheckingUsers(false);
        }
    }, []);

    React.useEffect(() => {
        loadLicenseStatus();
    }, [loadLicenseStatus]);

    React.useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    React.useEffect(() => {
        const onLicenseUpdate = (event) => {
            const detail = event?.detail;
            if (detail) {
                setLicenseInfo(detail);
                setLicenseModalOpen(!detail.valid);
                setShouldAutoPromptLogin(false);
            } else {
                loadLicenseStatus();
            }
        };

        window.addEventListener('license:updated', onLicenseUpdate);
        return () => window.removeEventListener('license:updated', onLicenseUpdate);
    }, [loadLicenseStatus]);

    React.useEffect(() => {
        if (licenseInfo == null) {
            return;
        }
        if (!licenseValid) {
            setCheckingUsers(false);
            setRequireUserSetup(false);
            setShouldAutoPromptLogin(false);
            return;
        }
        checkOnboardingStatus();
    }, [licenseInfo, licenseValid, checkOnboardingStatus]);

    React.useEffect(() => {
        if (!shouldAutoPromptLogin) return;
        if (!licenseValid || login || licenseModalOpen || requireUserSetup || checkingLicense) return;
        setLoginModal(true);
        setShouldAutoPromptLogin(false);
    }, [shouldAutoPromptLogin, licenseValid, login, licenseModalOpen, requireUserSetup, checkingLicense]);

    const navItems = React.useMemo(() => ([
        {icon: <HomeIcon/>, name: "POS", path: "/pos", visible: true},
        {icon: <CategoryIcon/>, name: "Produtos", path: "/products", visible: adminMode},
        {icon: <AssessmentIcon/>, name: "Relatórios", path: "/reports", visible: adminMode},
        {icon: <ImportExportIcon/>, name: "Importar/Exportar", path: "/migration", visible: adminMode},
        {icon: <PointOfSaleIcon/>, name: "Tesouraria", path: "/session", visible: adminMode && session !== null},
        {icon: <PeopleAltIcon/>, name: "Utilizadores", path: "/users", visible: adminMode},
        {icon: <SettingsIcon/>, name: "Configurações", path: "/setup", visible: adminMode},
        {icon: <VpnKeyIcon/>, name: "Licença", path: "/license", visible: adminMode},
        {icon: <InfoIcon/>, name: "Sobre", path: "/about", visible: true},
    ]), [session, adminMode]);

    const handleNav = (path) => {
        navigate(path);
        setOpen(false);
    };

    const doCloseWindow = () => {
        window.opener = null;
        window.open("", "_self");
        window.close();
    };

    const handleLogin = React.useCallback(async (value, userInfo = null) => {
        setLogin(value);

        if (value) {
            try {
                let resolvedUser = userInfo;
                if (!resolvedUser) {
                    const {data} = await UserService.getCurrent();
                    resolvedUser = data;
                }
                AuthService.setUser(resolvedUser || null);
                setCurrentUser(resolvedUser || null);
                const role = (resolvedUser?.role || '').toString().toLowerCase();
                const isAdmin = role.includes('admin');
                setAdminMode(isAdmin);
                setOpen(isAdmin);
            } catch (error) {
                console.error("Falha ao obter utilizador atual:", error?.response?.data || error);
                AuthService.setUser(null);
                setCurrentUser(null);
                setAdminMode(false);
                setOpen(false);
            }
        } else {
            AuthService.setUser(null);
            setCurrentUser(null);
            setAdminMode(false);
            setOpen(false);
        }
    }, []);

    const handleLogout = () => {
        setLogin(false);
        setAdminMode(false);
        setOpen(false);
        setLoginModal(false);
        setCurrentUser(null);
        setSession(null);
        AuthService.clearSession();
        navigate('/pos');
    };

    React.useEffect(() => {
        if (licenseInfo == null) {
            return;
        }
        if (!licenseValid) {
            AuthService.clearSession();
            setLogin(false);
            setAdminMode(false);
            setCurrentUser(null);
            setOpen(false);
            setSession(null);
            return;
        }

        let canceled = false;

        const restoreSession = async () => {
            if (AuthService.isAuthenticated()) {
                setLogin(true);
                try {
                    const {data} = await UserService.getCurrent();
                    if (canceled) return;
                    AuthService.setUser(data || null);
                    setCurrentUser(data || null);
                    const role = (data?.role || '').toString().toLowerCase();
                    const isAdmin = role.includes('admin');
                    setAdminMode(isAdmin);
                    setOpen(isAdmin);
                } catch (error) {
                    if (canceled) return;
                    console.error("Falha ao validar sessão:", error?.response?.data || error);
                    AuthService.clearSession();
                    setLogin(false);
                    setAdminMode(false);
                    setCurrentUser(null);
                    setOpen(false);
                    setShouldAutoPromptLogin(true);
                }
            } else {
                setLogin(false);
                setAdminMode(false);
                AuthService.setUser(null);
                setCurrentUser(null);
                setOpen(false);
                setShouldAutoPromptLogin(true);
            }

            if (!AuthService.isAuthenticated()) {
                setSession(null);
            }
        };

        restoreSession();

        return () => {
            canceled = true;
        };
    }, [licenseInfo, licenseValid]);

    React.useEffect(() => {
        const onKey = (e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
                setOpenCloseModal(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const title = React.useMemo(() => {
        const navItem = navItems.find((item) => item.path === location.pathname);
        if (navItem) return `TicketPrint — ${navItem.name}`;
        return 'TicketPrint';
    }, [location.pathname, navItems]);

    const appBarAlert = (!licenseValid) || Boolean(login && adminMode);
    const licenseAlertSeverity = licenseInfo?.status === 'expired' ? 'error' : 'warning';

    const sessionContextValue = React.useMemo(() => ({
        session,
        setSession,
        refreshSession,
        loading: sessionLoading,
    }), [session, setSession, refreshSession, sessionLoading]);

    return (
        <SessionProvider value={sessionContextValue}>
            <Box sx={{display: 'flex'}}>
            <CssBaseline/>

            <AppBar position="fixed" alert={appBarAlert}>
                <Toolbar sx={{gap: 1}}>
                    {login && adminMode && (
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            onClick={() => setOpen(true)}
                            edge="start"
                            sx={{mr: 2}}
                        >
                            <MenuIcon/>
                        </IconButton>
                    )}

                    <IconButton color="inherit" onClick={() => handleNav('/pos')}>
                        <Typography variant="h6" noWrap component="div">
                            {title}
                        </Typography>
                    </IconButton>

                    {login && adminMode && (
                        <Chip
                            label="Admin ativo — lembre-se de terminar sessão"
                            size="small"
                            sx={{
                                ml: 1,
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: 'inherit',
                                borderColor: 'rgba(255,255,255,0.35)',
                            }}
                            variant="outlined"
                        />
                    )}

                    <Box sx={{flexGrow: 1}}/>

                    {login && (
                        <>
                            {location.pathname === '/pos' && session && (
                                <IconButton color="inherit" disabled={!licenseValid || checkingLicense} onClick={() => {
                                    handleNav('/session')
                                }}>
                                    <Typography variant="h6" noWrap component="div"
                                                sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                        <PointOfSaleIcon fontSize="inherit"/> Sessão
                                    </Typography>
                                </IconButton>
                            )}
                            {(location.pathname === '/session' || location.pathname === '/about') && (
                                <IconButton color="inherit" disabled={!licenseValid || checkingLicense} onClick={() => {
                                    handleNav('/pos')
                                }}>
                                    <Typography variant="h6" noWrap component="div"
                                                sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                        <PlayArrowIcon fontSize="inherit"/> POS
                                    </Typography>
                                </IconButton>
                            )}
                        </>
                    )}

                    {!login ? (
                        <IconButton color="inherit" disabled={!licenseValid || checkingLicense} onClick={() => {
                            if (!requireUserSetup) {
                                setLoginModal(true);
                            }
                        }}>
                            <Typography variant="h6" noWrap component="div"
                                        sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LoginIcon fontSize="inherit"/> Iniciar Sessão
                            </Typography>
                        </IconButton>
                    ) : (
                        <IconButton color="inherit" onClick={handleLogout}>
                            <Typography variant="h6" noWrap component="div"
                                        sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LogoutIcon fontSize="inherit"/> Logout
                            </Typography>
                        </IconButton>
                    )}

                    <Tooltip title="Mais opções">
                        <IconButton color="inherit" onClick={openMore}>
                            <MoreVertIcon/>
                        </IconButton>
                    </Tooltip>

                    <Menu
                        anchorEl={moreAnchor}
                        open={moreOpen}
                        onClose={closeMore}
                        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                        transformOrigin={{vertical: 'top', horizontal: 'right'}}
                    >
                        <MenuItem
                            onClick={() => {
                                closeMore();
                                setOpenCloseModal(true);
                            }}
                        >
                            <ListItemIcon><ExitToAppIcon fontSize="small"/></ListItemIcon>
                            Fechar aplicação
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                closeMore();
                                handleNav('/about');
                            }}
                        >
                            <ListItemIcon><InfoIcon fontSize="small"/></ListItemIcon>
                            Sobre
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {login && adminMode && (
                <Drawer
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {width: drawerWidth, boxSizing: 'border-box'},
                    }}
                    variant="temporary"
                    anchor="left"
                    open={open}
                    onClose={() => setOpen(false)}
                    ModalProps={{keepMounted: true}}
                >
                    <DrawerHeader>
                        <IconButton onClick={() => setOpen(false)}>
                            {theme.direction === 'ltr' ? <ChevronLeftIcon/> : <ChevronRightIcon/>}
                        </IconButton>
                    </DrawerHeader>
                    <Divider/>
                    {navItems.map((item) => (
                        item.visible && (
                            <ListItem key={item.name} disablePadding onClick={() => handleNav(item.path)}>
                                <ListItemButton selected={location.pathname === item.path}>
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.name}/>
                                </ListItemButton>
                            </ListItem>
                        )
                    ))}
                    <Divider/>
                    {login && (
                        <List>
                            <ListItem disablePadding onClick={handleLogout}>
                                <ListItemButton>
                                    <ListItemIcon><LogoutIcon/></ListItemIcon>
                                    <ListItemText primary={"Terminar Sessão"}/>
                                </ListItemButton>
                            </ListItem>
                        </List>
                    )}
                </Drawer>
            )}

            <Main>
                <DrawerHeader/>
                {!checkingLicense && licenseInfo && !licenseValid && (
                    <Alert severity={licenseAlertSeverity} sx={{mb: 2}}>
                        {licenseInfo.message || 'A licença não é válida. Introduza um novo código.'}
                    </Alert>
                )}
                <Routes>
                    <Route path="/" element={<Navigate to="/pos" replace/>}/>
                    <Route
                        path="/pos"
                        element={<POSPage user={currentUser}/>}
                    />
                    <Route
                        path="/products"
                        element={login && adminMode ? <ProductsPage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route
                        path="/setup"
                        element={login && adminMode ? <SetupPage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route
                        path="/reports"
                        element={login && adminMode ? <ReportsPage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route
                        path="/migration"
                        element={login && adminMode ? <ImportExportPage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route
                        path="/users"
                        element={login && adminMode ? <UsersPage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route
                        path="/license"
                        element={login && adminMode ? <LicensePage/> : <Navigate to="/pos" replace/>}
                    />
                    <Route
                        path="/session"
                        element={login ? (
                            <SessionPage
                                onCloseSession={() => handleNav('/pos')}
                            />
                        ) : <Navigate to="/pos" replace/>}
                    />
                    {/* rota fallback */}
                    <Route path="*" element={<Navigate to="/pos" replace/>}/>
                </Routes>
            </Main>

            <Backdrop
                open={showLockScreen}
                sx={(theme) => ({
                    zIndex: theme.zIndex.modal - 1,
                    color: '#fff',
                    backdropFilter: 'blur(16px)',
                    p: 2,
                })}
            >
                <Paper
                    elevation={8}
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        alignItems: 'center',
                        width: 'min(420px, 90vw)',
                        textAlign: 'center',
                    }}
                >
                    <LockOutlinedIcon color="primary" sx={{fontSize: 48}}/>
                    <Typography variant="h5" component="h2">
                        Terminal bloqueado
                    </Typography>
                    <Typography variant="subtitle2">
                        Data e hora: {new Date().toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Inicie sessão com o seu perfil para continuar a utilizar o sistema.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={() => setLoginModal(true)}
                    >
                        Desbloquear
                    </Button>
                </Paper>
            </Backdrop>

            <LoginModal open={loginModal} close={(state) => setLoginModal(state)} setLogin={handleLogin}/>

            <InitialUserSetup
                open={!checkingUsers && requireUserSetup}
                onCompleted={async () => {
                    await checkOnboardingStatus();
                    setLoginModal(true);
                }}
            />

            <LicenseModal
                open={licenseModalOpen && !checkingLicense}
                status={licenseInfo}
                onApplied={async (data) => {
                    setLicenseInfo(data);
                    setLicenseModalOpen(!data?.valid);
                    setShouldAutoPromptLogin(false);

                    if (data?.valid) {
                        const needsSetup = await checkOnboardingStatus();
                        if (!needsSetup) {
                            setShouldAutoPromptLogin(true);
                        }
                    }
                }}
            />

            <Dialog
                open={openCloseModal}
                onClose={() => setOpenCloseModal(false)}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">{"Tem a certeza que pretende fechar?"}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        Ao fechar a aplicação, o POS-TicketPrint deixará de estar disponível.
                        <br/>
                        Confirme que pretende fechar a aplicação.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCloseModal(false)}>Cancelar</Button>
                    <Button onClick={doCloseWindow} autoFocus>Fechar</Button>
                </DialogActions>
            </Dialog>
            </Box>
        </SessionProvider>
    );
}

export default HomePage;
