import React, {useEffect} from 'react'
import {
    Box,
    Tab,
} from "@mui/material";
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import PrinterPage from "./PrinterPage";

function SetupPage() {
    const [tabPosition, setTabPosition] = React.useState("1");

    const handleTabChange = (event, newValue) => {
        setTabPosition(newValue);
    };

    useEffect(() => {
        if (localStorage.getItem("virtualKeyboard") === null) {
            localStorage.setItem("virtualKeyboard", "true");
        }
    }, []);

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
                        <h3>Teclado Virtual</h3>
                        <p>Ativa ou desativa o teclado virtual para os campos numéricos e de texto.</p>
                        <p>Esta configuração é guardada no navegador, por isso é aplicada a todos os utilizadores e
                            mantida entre sessões.</p>
                        <div className="form-check form-switch">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="virtualKeyboard"
                                defaultChecked={localStorage.getItem("virtualKeyboard") === "true"}
                                onChange={(e) => {
                                    localStorage.setItem("virtualKeyboard", String(e.target.checked));
                                }}
                            />
                            <label className="form-check-label" htmlFor="virtualKeyboard">
                                Teclado Virtual
                            </label>
                        </div>
                    </TabPanel>
                </TabContext>
            </div>
        </div>
    )
}

export default SetupPage
