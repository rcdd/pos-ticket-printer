import {BrowserRouter} from 'react-router-dom';
import HomePage from './pages/HomePage';
import {ToastProvider, useToast} from "./components/Common/ToastProvider";
import {useEffect} from "react";

function AppEventsBridge() {
    const {pushError} = useToast();

    useEffect(() => {
        const handleUnhandledRejection = (event) => {
            const reason = event?.reason;
            const message = reason?.message || reason?.toString?.() || "Erro inesperado.";
            pushError(message, {title: "Erro inesperado"});
        };

        const handleWindowError = (event) => {
            const message = event?.message || "Erro inesperado.";
            pushError(message, {title: "Erro inesperado"});
        };

        window.addEventListener("unhandledrejection", handleUnhandledRejection);
        window.addEventListener("error", handleWindowError);

        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            window.removeEventListener("error", handleWindowError);
        };
    }, [pushError]);

    return (
        <BrowserRouter>
            <HomePage/>
        </BrowserRouter>
    );
}

function App() {
    return (
        <ToastProvider
            defaultTitle="Operation failed"
            defaultAutoHideDuration={6000}
            defaultAnchorOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <AppEventsBridge/>
        </ToastProvider>
    );
}

export default App;
