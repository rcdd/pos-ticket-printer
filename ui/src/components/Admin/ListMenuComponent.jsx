import React from 'react'

function ListProductComponent({menus, editMenu}) {
    return (
        <div className='row'>
            <div className='col-lg-7'>
                <div className='row'>
                    {menus.length !== 0 && menus.map((menu, key) =>
                        <div key={key} className='col-lg-4 mb-4'>
                            <div className='pos-item px-3 text-center border'
                                 onClick={() => editMenu(menu)}>
                                <h2>{menu.name}</h2>
                                {menu.products.map((product, productKey) =>
                                    <p key={productKey}>{product.name}</p>
                                )}
                                <h5>{(menu.price / 100).toFixed(2)}€</h5>
                            </div>
                        </div>
                    )}
                    {menus.length === 0 && <p>Não existem produtos</p>}
                </div>
            </div>
        </div>
    )
}

export default ListProductComponent
