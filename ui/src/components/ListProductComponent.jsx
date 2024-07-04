import React from 'react'

function ListProductComponent({products, editProduct}) {

    return (
        <div className='row'>
            <div className='col-lg-7'>
                <div className='row'>
                    {products.length !== 0 && products.map((product, key) =>
                        <div key={key} className='col-lg-4 mb-4'>
                            <div className='pos-item px-3 text-center border'
                                 onClick={() => editProduct(product)}>
                                <p>{product.name}</p>
                                <img draggable="false" src={product.image} className="pos-item__image"
                                     alt={product.name}/>
                                <p>{(product.price / 100).toFixed(2)}€</p>
                            </div>
                        </div>
                    )}
                    {products.length === 0 && <p>Não existem produtos</p>}
                </div>
            </div>
        </div>
    )
}

export default ListProductComponent
