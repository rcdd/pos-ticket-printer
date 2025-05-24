import React from 'react'
import {ListProductsComponent} from './ListProductsComponent';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import {Tabs} from "@mui/material";
import TabPanel from "@mui/lab/TabPanel";
import TabContext from "@mui/lab/TabContext";

export function ZoneSelectionComponent({
                                           isLoading,
                                           productsFood,
                                           productsDrink,
                                           menus,
                                           addProductToCart
                                       }) {

    const [value, setValue] = React.useState('drink');

    const handleTabChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <div className='products-wrapper col-lg-7 col-md-6'>
            {isLoading ? 'Loading...' : null}

            {productsFood.length === 0 && productsFood.length === 0 && menus.length === 0 ?
                <h3>Sem produtos definidos!</h3> :
                <TabContext value={value}>
                    <Box sx={{width: '100%'}}>
                        <Tabs
                            value={value}
                            onChange={handleTabChange}
                            textColor="primary"
                            indicatorColor="primary"
                            aria-label="Item tabs"
                            style={{borderBottom: 1, borderColor: 'divider'}}
                        >
                            {productsDrink.length && <Tab style={{fontSize: 20 + "px"}} value="drink" label="Bebidas"/>}
                            {productsFood.length && <Tab style={{fontSize: 20 + "px"}} value="food" label="Comidas"/>}
                            {menus.length && <Tab style={{fontSize: 20 + "px"}} value="menu" label="Menus"/>}
                        </Tabs>
                        <TabPanel value="drink">
                            <ListProductsComponent products={productsDrink} addToCart={addProductToCart}/>
                        </TabPanel>
                        <TabPanel value="food">
                            <ListProductsComponent products={productsFood} addToCart={addProductToCart}/>
                        </TabPanel>
                        <TabPanel value="menu">
                            <ListProductsComponent products={menus} addToCart={addProductToCart}/>
                        </TabPanel>
                    </Box>
                </TabContext>
            }
        </div>
    )
}