import React from 'react'
import {ProductComponent} from "../Admin/ProductComponent";

export function ListProductsComponent({products, addToCart}) {

    return (
        <div className='products-list'>
            <div className='row'>
                {products.length !== 0 ? products.sort((a, b) => a.position - b.position)
                    .map((product, key) =>
                        <div key={key} className='col-lg-4 mb-4'
                             onClick={() => addToCart(product)}>
                            <ProductComponent item={product}/>
                        </div>) : <h4>Sem produtos</h4>}
            </div>
        </div>
    )
}