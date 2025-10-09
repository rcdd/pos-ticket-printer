import React, {useEffect, useState} from 'react'
import {ProductComponent} from "../Common/ProductComponent";
import {Box} from "@mui/material";

export function ListProductsComponent({products, addToCart}) {
    const [windowsWidth, setWindowsWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowsWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className='products-list'>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(' + (windowsWidth < 1200 ? '150px' : '250px') + ', 1fr))',
                    gap: 1,
                    px: 1,
                    py: 2,
                }}
            >
                {products.length !== 0 ? products
                    .sort((a, b) => a.position - b.position)
                    .map((item) => (
                        <div key={item.id}
                             onClick={() => addToCart(item)}>
                            <ProductComponent item={item}/>
                        </div>
                    )) : <h4>Sem produtos</h4>}
            </Box>
        </div>
    )
}