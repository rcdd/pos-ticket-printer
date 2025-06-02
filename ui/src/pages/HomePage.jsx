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
import SetupPage from "./SetupPage";
import ReportsPage from "./ReportsPage";
import Box from "@mui/material/Box";
import POSPage from "./POSPage";
import AboutPage from "./AboutPage";
import LoginModal from "../components/Admin/LoginModal";

const drawerWidth = 240;

const Main = styled('main', {shouldForwardProp: (prop) => prop !== 'open'})(({theme}) => ({
    flexGrow: 1, padding: theme.spacing(3), transition: theme.transitions.create('margin', {
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

    const nav = useNavigate();

    React.useEffect(() => {
        const loginData = localStorage.getItem("login");
        if (loginData) {
            const loginTime = new Date(loginData);
            const currentTime = new Date();
            if (currentTime - loginTime < 1000 * 60 * 60) { // 1 hour
                setLogin(true);
            } else {
                localStorage.removeItem("login");
                setPage("pos");
            }
        }
    }, []);

    const handleLogout = () => {
        setLogin(false);
        setPage("pos");
        setOpen(false);
        localStorage.removeItem("login");
    }

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
                        POS-TicketPrint {page !== 'pos' && page !== 'about' ? " - Administração" : nav.name}
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
            <List>
                <ListItem disablePadding onClick={() => setPage('pos')}>
                    <ListItemButton>
                        <ListItemIcon>
                            <HomeIcon/>
                        </ListItemIcon>
                        <ListItemText primary={"POS"}/>
                    </ListItemButton>
                </ListItem>
            </List>
            <Divider/>
            <List>
                <ListItem disablePadding onClick={() => setPage('setup')}>
                    <ListItemButton>
                        <ListItemIcon>
                            <SettingsIcon/>
                        </ListItemIcon>
                        <ListItemText primary={"Configurações"}/>
                    </ListItemButton>
                </ListItem>
                <ListItem disablePadding onClick={() => setPage('reports')}>
                    <ListItemButton>
                        <ListItemIcon>
                            <AssessmentIcon/>
                        </ListItemIcon>
                        <ListItemText primary={"Movimentos"}/>
                    </ListItemButton>
                </ListItem>
            </List>
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
            {page === "pos" && <POSPage/>}
            {page === "setup" && <SetupPage/>}
            {page === "reports" && <ReportsPage/>}
            {page === "about" && <AboutPage/>}
        </Main>

        <LoginModal open={loginModal} close={() => setLoginModal(false)} setLogin={setLogin}/>
    </Box>)
}

export default HomePage
