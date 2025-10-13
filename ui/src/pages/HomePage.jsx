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

    const items = React.useMemo(() => ([
        {icon: <HomeIcon/>, name: "POS", path: "/pos", visible: true},
        {icon: <CategoryIcon/>, name: "Produtos", path: "/products", visible: true},
        {icon: <AssessmentIcon/>, name: "Relatórios", path: "/reports", visible: true},
        {icon: <ImportExportIcon/>, name: "Importar/Exportar", path: "/migration", visible: true},
        {icon: <PointOfSaleIcon/>, name: "Tesouraria", path: "/session", visible: session !== null},
        {icon: <SettingsIcon/>, name: "Configurações", path: "/setup", visible: true},
        {icon: <InfoIcon/>, name: "Sobre", path: "/about", visible: true},
    ]), [session]);

    const handleNav = (path) => {
        navigate(path);
        setOpen(false);
        if (login) {
            const userRaw = localStorage.getItem("user");
            if (userRaw) {
                const userData = JSON.parse(userRaw);
                userData.loginExpires = Date.now() + 60 * 60 * 1000; // 1 hora
                localStorage.setItem("user", JSON.stringify(userData));
            }
        }
    };

    const doCloseWindow = () => {
        window.opener = null;
        window.open("", "_self");
        window.close();
    };

    const handleLogin = (value) => {
        setLogin(value);

        if (value) {
            try {
                const raw = localStorage.getItem("user");
                const u = raw ? JSON.parse(raw) : null;
                const role = (u?.role || u?.roles || '').toString().toLowerCase();
                setAdminMode(role.includes('admin'));
            } catch (_) {
                setAdminMode(false);
            }
            setOpen(true);
        } else {
            setAdminMode(false);
        }
    };

    const handleLogout = () => {
        setLogin(false);
        setAdminMode(false);
        setOpen(false);
        setLoginModal(false);
        localStorage.removeItem("login");
        const userRaw = localStorage.getItem("user");
        if (userRaw) localStorage.removeItem("user");
        closeUserMenu();
        navigate('/pos');
    };

    React.useEffect(() => {
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
            const userData = JSON.parse(userRaw);
            const loginExpire = Number(userData?.loginExpires || 0);
            const now = Date.now();
            const isValid = now < loginExpire;

            if (isValid) {
                setLogin(true);
                userData.loginExpires = now + 60 * 60 * 1000; // 1 hora
                localStorage.setItem("user", JSON.stringify(userData));
                const role = (userData.role || '').toString().toLowerCase();
                setAdminMode(role.includes('admin'));
            } else {
                localStorage.removeItem("user");
                navigate('/pos', {replace: true});
            }
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
                        <IconButton color="inherit" onClick={() => setLoginModal(true)}>
                            <Typography variant="h6" noWrap component="div"
                                        sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LoginIcon fontSize="inherit"/> Login
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
                                <ListItemText primary={"Logout"}/>
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
                    <Route path="/session" element={<SessionPage session={session} setSession={setSession}
                                                                 onCloseSession={() => handleNav('/pos')}/>}/>
                    {/* rota fallback */}
                    <Route path="*" element={<Navigate to="/pos" replace/>}/>
                </Routes>
            </Main>

            <LoginModal open={loginModal} close={(state) => setLoginModal(state)} setLogin={handleLogin}/>

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
