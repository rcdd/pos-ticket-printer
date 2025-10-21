import React, {useEffect, useState} from 'react'
import {ListProductsComponent} from './ListProductsComponent';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabPanel from "@mui/lab/TabPanel";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";

import FavoriteIcon from '@mui/icons-material/Favorite';

export function ZoneSelectionComponent({
                                           isLoading,
                                           zones,
                                           products,
                                           menus,
                                           favorites,
                                           favoritesEnabled,
                                           addProductToCart
                                       }) {

    const [value, setValue] = React.useState("");

    const [windowsWidth, setWindowsWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowsWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleTabChange = (event, newValue) => {
        setValue(newValue);
    };

    const hasMenus = menus.length > 0;
    const favoritesAvailable = favoritesEnabled && Array.isArray(favorites) && favorites.length > 0;

    React.useEffect(() => {
        const nextValue = favoritesAvailable
            ? 'favorites'
            : zones.length
                ? zones[0].name
                : hasMenus
                    ? "menu"
                    : null;
        setValue(nextValue);
    }, [products, zones, menus, favorites, favoritesAvailable, hasMenus]);

    return (
        <div>
            {isLoading ? 'Loading...' :
                !favoritesAvailable && products.length === 0 && menus.length === 0 ?
                    <h3>Sem produtos definidos!</h3> :
                    value && <TabContext value={value}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <TabList
                                value={value}
                                onChange={handleTabChange}
                            >
                                {favoritesAvailable && (
                                    <Tab
                                        icon={<FavoriteIcon color="error"/>}
                                        iconPosition="start"
                                        style={{fontSize: windowsWidth < 1200 ? 14 : 18}}
                                        key="favorites"
                                        label=""
                                        value="favorites"
                                    />
                                )}
                                {zones && zones.map((zone) => (
                                    <Tab style={{fontSize: windowsWidth < 1200 ? 14 : 18}} key={zone.id} label={zone.name} value={zone.name}/>
                                ))}

                                {hasMenus && <Tab style={{fontSize: 16 + "px"}} value="menu" label="Menus"/>}
                            </TabList>
                        </Box>

                        {favoritesAvailable && (
                            <TabPanel style={{padding: 1}} key="favorites" value="favorites">
                                <ListProductsComponent products={favorites}
                                                       addToCart={addProductToCart}/>
                            </TabPanel>
                        )}

                        {zones && zones.map((zone) => (
                            <TabPanel style={{padding: 1}} key={zone.id} value={zone.name}>
                                <ListProductsComponent products={products.filter(p => p.zoneId === zone.id)}
                                                       addToCart={addProductToCart}/>
                            </TabPanel>
                        ))}

                        {hasMenus && (
                            <TabPanel style={{padding: 1}} value="menu">
                                <ListProductsComponent products={menus} addToCart={addProductToCart}/>
                            </TabPanel>
                        )}
                    </TabContext>
            }
        </div>
    )
}
