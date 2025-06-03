import React from 'react'
import {ListProductsComponent} from './ListProductsComponent';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabPanel from "@mui/lab/TabPanel";
import TabContext from "@mui/lab/TabContext";
import TabList from "@mui/lab/TabList";

export function ZoneSelectionComponent({
                                           isLoading,
                                           productsFood,
                                           productsDrink,
                                           menus,
                                           addProductToCart
                                       }) {

    const [value, setValue] = React.useState(null);

    const handleTabChange = (event, newValue) => {
        setValue(newValue);
    };

    React.useEffect(() => {
        if (productsDrink.length > 0) {
            setValue('drink');
        } else if (productsFood.length > 0) {
            setValue('food');
        } else if (menus.length > 0) {
            setValue('menu');
        } else {
            setValue(null);
        }
    }, [productsDrink, productsFood, menus]);

    return (
        <div className='products-wrapper col-xl-7 col-lg-6 col-md-6'>
            {isLoading ? 'Loading...' :
                productsFood.length === 0 && productsFood.length === 0 && menus.length === 0 ?
                    <h3>Sem produtos definidos!</h3> :
                    value && <TabContext value={value}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <TabList
                                value={value}
                                onChange={handleTabChange}
                            >
                                {productsDrink.length && <Tab style={{fontSize: 16 + "px"}} value="drink" label="Bebidas"/>}
                                {productsFood.length && <Tab style={{fontSize: 16 + "px"}} value="food" label="Comidas"/>}
                                {menus.length && <Tab style={{fontSize: 16 + "px"}} value="menu" label="Menus"/>}
                            </TabList>
                        </Box>
                        <TabPanel style={{padding: "20px 0"}} value="drink">
                            <ListProductsComponent products={productsDrink} addToCart={addProductToCart}/>
                        </TabPanel>
                        <TabPanel style={{padding: "20px 0"}} value="food">
                            <ListProductsComponent products={productsFood} addToCart={addProductToCart}/>
                        </TabPanel>
                        <TabPanel style={{padding: "20px 0"}} value="menu">
                            <ListProductsComponent products={menus} addToCart={addProductToCart}/>
                        </TabPanel>
                    </TabContext>
            }
        </div>
    )
}