import React from 'react'

export function ListProductsComponent({ products, addToCart }) {

    return (
        <div className='products-list'>
            <div className='row'>
                {products.length !== 0 ? products.map((product, key) => <div key={key} className='col-lg-4 mb-4'>
                    <div className='pos-item px-3 text-center border'
                        onClick={() => addToCart(product)}>
                        <p className="pos-item__name">{product.name}</p>
                        <img draggable="false" src={product.image ?? "../imgs/menu.png"} className="pos-item__image"
                            alt={product.name} />
                        <p>{(product.price / 100).toFixed(2)}€</p>
                    </div>
                </div>) : <h4>Sem produtos</h4>}
            </div>
        </div>
    )
}