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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import UsersPage from "./Admin/UsersPage";
import InitialUserSetup from "../components/Admin/InitialUserSetup";
import AuthService from "../services/auth.service";
import UserService from "../services/user.service";
import OptionService from "../services/option.service";

const drawerWidth = 240;

const Main = styled('main', {shouldForwardProp: (prop) => prop !== 'open'})(({theme}) => ({
    flexGrow: 1,
    padding: theme.spacing(2),
}));

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open' && prop !== 'alert',
})(({theme, alert}) => ({
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: alert ? theme.palette.error.main : undefined,
    color: alert ? theme.palette.getContrastText(theme.palette.error.main) : undefined,
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
    const [adminMode, setAdminMode] = React.useState(false);
    const [moreAnchor, setMoreAnchor] = React.useState(null);
    const moreOpen = Boolean(moreAnchor);
    const openMore = (e) => setMoreAnchor(e.currentTarget);
    const closeMore = () => setMoreAnchor(null);

    const [/*userMenuAnchor*/, setUserMenuAnchor] = React.useState(null);
    const closeUserMenu = () => setUserMenuAnchor(null);

    const [checkingUsers, setCheckingUsers] = React.useState(true);
    const [requireUserSetup, setRequireUserSetup] = React.useState(false);

    const checkOnboardingStatus = React.useCallback(async () => {
        setCheckingUsers(true);
        try {
            const {data} = await OptionService.getOnboardingStatus();
            setRequireUserSetup(!(data?.completed));
        } catch (error) {
            console.error("Erro ao verificar estado de onboarding:", error?.response || error);
            setRequireUserSetup(false);
        } finally {
            setCheckingUsers(false);
        }
    }, []);

    React.useEffect(() => {
        checkOnboardingStatus();
    }, [checkOnboardingStatus]);

    const items = React.useMemo(() => ([
        {icon: <HomeIcon/>, name: "POS", path: "/pos", visible: true},
        {icon: <CategoryIcon/>, name: "Produtos", path: "/products", visible: true},
        {icon: <AssessmentIcon/>, name: "Relatórios", path: "/reports", visible: adminMode},
        {icon: <ImportExportIcon/>, name: "Importar/Exportar", path: "/migration", visible: true},
        {icon: <PointOfSaleIcon/>, name: "Tesouraria", path: "/session", visible: session !== null},
        {icon: <PeopleAltIcon/>, name: "Utilizadores", path: "/users", visible: adminMode},
        {icon: <SettingsIcon/>, name: "Configurações", path: "/setup", visible: adminMode},
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
                const role = (resolvedUser?.role || '').toString().toLowerCase();
                setAdminMode(role.includes('admin'));
            } catch (error) {
                console.error("Falha ao obter utilizador atual:", error?.response?.data || error);
                setAdminMode(false);
            }
            setOpen(true);
        } else {
            setAdminMode(false);
        }
    }, []);

    const handleLogout = () => {
        setLogin(false);
        setAdminMode(false);
        setOpen(false);
        setLoginModal(false);
        AuthService.clearSession();
        closeUserMenu();
        navigate('/pos');
    };

    React.useEffect(() => {
        if (AuthService.isAuthenticated()) {
            (async () => {
                try {
                    const {data} = await UserService.getCurrent();
                    setLogin(true);
                    const role = (data?.role || '').toString().toLowerCase();
                    setAdminMode(role.includes('admin'));
                } catch (error) {
                    console.error("Falha ao validar sessão:", error?.response?.data || error);
                    AuthService.clearSession();
                    setLogin(false);
                    setAdminMode(false);
                }
            })();
        } else {
            AuthService.clearSession();
        }

        SessionService.getActiveSession()
            .then((response) => setSession(response.data))
            .catch((error) => {
                if (error.response && error.response.status !== 404) {
                    console.log(error.response);
                }
                setSession(null);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        if (location.pathname.startsWith('/about')) return 'TicketPrint — Sobre';
        if (location.pathname === '/pos') return 'TicketPrint';
        return 'TicketPrint — Administração';
    }, [location.pathname]);

    const appBarAlert = Boolean(login && adminMode);

    return (
        <Box sx={{display: 'flex'}}>
            <CssBaseline/>

            <AppBar position="fixed" alert={appBarAlert}>
                <Toolbar sx={{gap: 1}}>
                    {login && (
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

                    {!login ? (
                        <IconButton color="inherit" onClick={() => {
                            if (!requireUserSetup) {
                                setLoginModal(true);
                            }
                        }}>
                            <Typography variant="h6" noWrap component="div"
                                        sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LoginIcon fontSize="inherit"/> Login
                            </Typography>
                        </IconButton>
                    ) : (
                        <IconButton color="inherit" onClick={handleLogout}>
                            <Typography variant="h6" noWrap component="div"
                                        sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LogoutIcon fontSize="inherit"/> Terminar Sessão
                            </Typography>
                        </IconButton>
                    )}

                    {/* Kebab sempre visível (mesmo sem login) */}
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
                {items.map((item) => (
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

            <Main>
                <DrawerHeader/>
                {/* Rotas reais — podes refrescar sem perder a página */}
                <Routes>
                    <Route path="/" element={<Navigate to="/pos" replace/>}/>
                    <Route path="/pos" element={<POSPage session={session} setSession={setSession}/>}/>
                    <Route path="/products" element={<ProductsPage/>}/>
                    <Route path="/setup" element={<SetupPage/>}/>
                    <Route path="/reports" element={<ReportsPage/>}/>
                    <Route path="/about" element={<AboutPage/>}/>
                    <Route path="/migration" element={<ImportExportPage/>}/>
                    <Route path="/users" element={<UsersPage/>}/>
                    <Route path="/session" element={<SessionPage session={session} setSession={setSession}
                                                                 onCloseSession={() => handleNav('/pos')}/>}/>
                    {/* rota fallback */}
                    <Route path="*" element={<Navigate to="/pos" replace/>}/>
                </Routes>
            </Main>

            <LoginModal open={loginModal} close={(state) => setLoginModal(state)} setLogin={handleLogin}/>

            <InitialUserSetup
                open={!checkingUsers && requireUserSetup}
                onCompleted={async () => {
                    await checkOnboardingStatus();
                    setLoginModal(true);
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
    );
}

export default HomePage;
