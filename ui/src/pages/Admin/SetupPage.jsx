import React from 'react'
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
                        <h3>Sem configurações ainda...</h3>
                    </TabPanel>
                </TabContext>
            </div>
        </div>
    )
}

export default SetupPage
