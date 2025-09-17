import React from 'react'
import {ListProductsComponent} from './ListProductsComponent';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabPanel from "@mui/lab/TabPanel";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";

export function ZoneSelectionComponent({
                                           isLoading,
                                           zones,
                                           products,
                                           menus,
                                           addProductToCart
                                       }) {

    const [value, setValue] = React.useState(null);

    const handleTabChange = (event, newValue) => {
        setValue(newValue);
    };

    React.useEffect(() => {
        setValue(zones.length ? zones[0].name : menus.length ? "menu" : null);
    }, [products, zones, menus]);

    return (
        <div className='products-wrapper col-xl-7 col-lg-6 col-md-6'>
            {isLoading ? 'Loading...' :
                products.length === 0 && menus.length === 0 ?
                    <h3>Sem produtos definidos!</h3> :
                    value && <TabContext value={value ?? null}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <TabList
                                value={value}
                                onChange={handleTabChange}
                            >
                                {zones && zones.map((zone) => (
                                    <Tab style={{fontSize: 16 + "px"}} key={zone.id} label={zone.name} value={zone.name}/>
                                ))}

                                {menus.length && <Tab style={{fontSize: 16 + "px"}} value="menu" label="Menus"/>}
                            </TabList>
                        </Box>

                        {zones && zones.map((zone) => (
                            <TabPanel style={{padding: "20px 0"}} key={zone.id} value={zone.name}>
                                <ListProductsComponent products={products.filter(p => p.zoneId === zone.id)}
                                                       addToCart={addProductToCart}/>
                            </TabPanel>
                        ))}

                        <TabPanel style={{padding: "20px 0"}} value="menu">
                            <ListProductsComponent products={menus} addToCart={addProductToCart}/>
                        </TabPanel>
                    </TabContext>
            }
        </div>
    )
}