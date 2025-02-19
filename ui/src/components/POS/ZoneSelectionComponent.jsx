import React from 'react'
import {ListProductsComponent} from './ListProductsComponent';

export function ZoneSelectionComponent({
                                           zone,
                                           setZone,
                                           isLoading,
                                           productsFood,
                                           productsDrink,
                                           menus,
                                           addProductToCart
                                       }) {
    return (
        <div className='col-lg-7'>
            {isLoading ? 'Loading...' : null}
            {zone !== null ? <div style={{display: "flex"}} className='mb-3'>
                <div className='pos-item p-4 px-5' onClick={() => setZone(null)}>🔙 Retroceder</div>
                <h3 className='p-3 px-5 text-center'>{zone === 'food' ? "Comidas" : zone === 'drink' ? "Bebidas" : "Menus"}</h3>
            </div> : null}

            {zone === null ? <div>
                    <div className='pos-item mt-3 mb-4 p-5 text-center border'
                         onClick={() => setZone('food')}>
                        <p>Comidas</p>
                        <        img draggable="false" src="../imgs/restaurant-icon.png" className="pos-item__image"
                                     alt=""/>
                    </div>
                    <div className='pos-item mb-4 p-5 text-center border'
                         onClick={() => setZone('drink')}>
                        <p>Bebidas</p>
                        <        img draggable="false" src="../imgs/bar-icon.png" className="pos-item__image"
                                     alt=""/>
                    </div>
                    {menus.length > 0 && <div className='pos-item p-5 text-center border'
                                              onClick={() => setZone('menu')}>
                        <p>Menus</p>
                        <        img draggable="false" src="../imgs/menu.png" className="pos-item__image"
                                     alt=""/>
                    </div>}
                </div> :
                zone === 'food' ? <ListProductsComponent products={productsFood} addToCart={addProductToCart}/> :
                    zone === 'drink' ?
                        <ListProductsComponent products={productsDrink} addToCart={addProductToCart}/> :
                        zone === 'menu' ?
                            <ListProductsComponent products={menus} addToCart={addProductToCart}/> : null}
        </div>
    )
}