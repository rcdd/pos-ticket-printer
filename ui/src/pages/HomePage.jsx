import React from 'react'
import {useNavigate} from 'react-router-dom'
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

const drawerWidth = 240;

const Main = styled('main', {shouldForwardProp: (prop) => prop !== 'open'})(({theme}) => ({
    flexGrow: 1, padding: theme.spacing(2), transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.leavingScreen,
    }), marginLeft: `-${drawerWidth}px`, variants: [{
        props: ({open}) => open, style: {
            transition: theme.transitions.create('margin', {
                easing: theme.transitions.easing.easeOut, duration: theme.transitions.duration.enteringScreen,
            }), marginLeft: 0,
        },
    },],
}),);

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})(({theme}) => ({
    transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.leavingScreen,
    }), variants: [{
        props: ({open}) => open, style: {
            width: `calc(100% - ${drawerWidth}px)`,
            marginLeft: `${drawerWidth}px`,
            transition: theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.easeOut, duration: theme.transitions.duration.enteringScreen,
            }),
        },
    },],
}));

const DrawerHeader = styled('div')(({theme}) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1), ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));


function HomePage() {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);
    const [loginModal, setLoginModal] = React.useState(false);
    const [login, setLogin] = React.useState(false);
    const [page, setPage] = React.useState("pos");
    const [openCloseModal, setOpenCloseModal] = React.useState(false);
    const [session, setSession] = React.useState(null);

    const nav = useNavigate();

    const navigationMap = [
        {icon: <HomeIcon/>, name: "POS", path: "pos", visible: true},
        {icon: <CategoryIcon/>, name: "Produtos", path: "products", visible: true},
        {icon: <AssessmentIcon/>, name: "Relatórios", path: "reports", visible: true},
        {icon: <ImportExportIcon/>, name: "Importar/Exportar", path: "migration", visible: true},
        {icon: <PointOfSaleIcon/>, name: "Tesouraria", path: "session", visible: session !== null},
        {icon: <SettingsIcon/>, name: "Configurações", path: "setup", visible: true},
    ]
    const closeWindow = () => {
        setOpenCloseModal(true);
    }

    const doCloseWindow = () => {
        window.opener = null;
        window.open("", "_self");
        window.close();
    };

    const handleLogin = (value) => {
        setLogin(value);
        if (value) {
            setOpen(true);
        }
    }

    const handleLogout = () => {
        setLogin(false);
        setPage("pos");
        setOpen(false);
        setLoginModal(false);
        localStorage.removeItem("login");
    }

    const handleNavigation = (path) => {
        setPage(path);
        setOpen(false);
    }

    React.useEffect(() => {
        const loginData = localStorage.getItem("login");
        if (loginData) {
            const loginTime = new Date(loginData);
            const currentTime = new Date();
            if (currentTime - loginTime < 1000 * 60 * 60) { // 1 hour
                setLogin(true);
                localStorage.setItem("login", String(Date.now() + 60 * 60 * 1000));
            } else {
                localStorage.removeItem("login");
                setPage("pos");
            }
        }

        SessionService.getActiveSession().then((response) => {
            setSession(response.data);
        }).catch((error) => {
            if (error.response && error.response.status !== 404) {
                console.log(error.response);
                throw Error(error.response.data.message)
            }
            setSession(null)
        });
    }, []);


    return (<Box sx={{display: 'flex'}}>
        <CssBaseline/>
        <AppBar position="fixed" open={open}>
            <Toolbar>
                {login && <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    onClick={() => setOpen(true)}
                    edge="start"
                    sx={[{
                        mr: 2,
                    }, open && {display: 'none'},]}
                >
                    <MenuIcon/>
                </IconButton>}
                <IconButton
                    color="inherit"
                    onClick={() => setPage('pos')}
                >
                    <Typography variant="h6" noWrap component="div">
                        TicketPrint {page !== 'pos' && page !== 'about' ? " - Administração" : nav.name}
                    </Typography>
                </IconButton>
                <h3 style={{margin: "0 12px"}}> | </h3>
                {!login && <IconButton
                    color="inherit"
                    onClick={() => setLoginModal(true)}
                >
                    <Typography variant="h6" noWrap component="div">
                        <LoginIcon/> Login
                    </Typography>
                </IconButton>}
                {login && <IconButton
                    color="inherit"
                    onClick={() => handleLogout()}
                >
                    <Typography variant="h6" noWrap component="div">
                        <LogoutIcon/> Logout
                    </Typography>
                </IconButton>}
                <div style={{flexGrow: 1}}/>
                <IconButton
                    color="inherit"
                    onClick={() => setPage('about')}
                >
                    <Typography variant="h6" noWrap component="div">
                        <InfoIcon/>
                    </Typography>
                </IconButton>

                <IconButton
                    color="inherit"
                    onClick={() => closeWindow()}
                >
                    <Typography variant="h6" color={"red"} noWrap component="div">
                        <ExitToAppIcon/>
                    </Typography>
                </IconButton>
            </Toolbar>
        </AppBar>
        <Drawer
            sx={{
                width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': {
                    width: drawerWidth, boxSizing: 'border-box',
                },
            }}
            variant="persistent"
            anchor="left"
            open={open}
        >
            <DrawerHeader>
                <IconButton onClick={() => setOpen(false)}>
                    {theme.direction === 'ltr' ? <ChevronLeftIcon/> : <ChevronRightIcon/>}
                </IconButton>
            </DrawerHeader>
            <Divider/>
            {navigationMap.map((nav) => (
                nav.visible &&
                <ListItem key={nav.name} disablePadding onClick={() => handleNavigation(nav.path)}>
                    <ListItemButton selected={page === nav.path}>
                        <ListItemIcon>
                            {nav.icon}
                        </ListItemIcon>
                        <ListItemText primary={nav.name}/>
                    </ListItemButton>
                </ListItem>
            ))}
            <Divider/>
            <List>
                <ListItem disablePadding onClick={() => handleLogout()}>
                    <ListItemButton>
                        <ListItemIcon>
                            <LogoutIcon/>
                        </ListItemIcon>
                        <ListItemText primary={"Logout"}/>
                    </ListItemButton>
                </ListItem>
            </List>
        </Drawer>
        <Main open={open}>
            <DrawerHeader/>
            {page === "pos" && <POSPage session={session} setSession={setSession}/>}
            {page === "products" && <ProductsPage/>}
            {page === "setup" && <SetupPage/>}
            {page === "reports" && <ReportsPage/>}
            {page === "about" && <AboutPage/>}
            {page === "migration" && <ImportExportPage/>}
            {page === "session" &&
                <SessionPage session={session} setSession={setSession} onCloseSession={() => setPage("pos")}/>}
        </Main>

        <LoginModal open={loginModal} close={(state) => setLoginModal(state)} setLogin={handleLogin}/>
        <Dialog
            open={openCloseModal}
            onClose={() => setOpenCloseModal(false)}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">
                {"Tem a certeza que pretende fechar?"}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    Ao fechar a aplicação, o POS-TicketPrint deixará de estar disponível.
                    <br/>
                    Confirme que pretende fechar a aplicação.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpenCloseModal(false)}>Cancelar</Button>
                <Button onClick={doCloseWindow} autoFocus>
                    Fechar
                </Button>
            </DialogActions>
        </Dialog>
    </Box>)
}

export default HomePage
