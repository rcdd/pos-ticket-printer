import {
    BrowserRouter as Router,
    Routes,
    Route,
} from 'react-router-dom';
import HomePage from './pages/HomePage';
import {ToastProvider} from "./components/Common/ToastProvider";
import {useEffect} from "react";

function App() {
    useEffect(() => {
        const handleContextmenu = e => {
            e.preventDefault()
        }
        document.addEventListener('contextmenu', handleContextmenu)
        return function cleanup() {
            document.removeEventListener('contextmenu', handleContextmenu)
        }
    }, [])

    return (
        <ToastProvider
            defaultTitle="Operation failed"
            defaultAutoHideDuration={6000}
            defaultAnchorOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <Router>
                <Routes>
                    <Route path="/" element={<HomePage/>}/>
                </Routes>
            </Router>
        </ToastProvider>
    );
}

export default App;
