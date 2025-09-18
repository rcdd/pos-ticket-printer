import React from 'react'
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import {Button, IconButton} from "@mui/material";

export function CartComponent({cart, totalAmount, increaseQuantity, decreaseQuantity, removeProduct, handlePayment}) {

    return (
        <div className='col-xl-5 col-lg-6 col-md-6 cart-wrapper'>
            <div className='table-responsive-wrapper bg-dark'>
                <table className='table table-responsive table-dark table-hover'>
                    <thead>
                    <tr>
                        <th style={{width: "100px", textAlign: 'center'}}>Qth</th>
                        <th style={{width: "200px"}}>Item</th>
                        <th style={{width: "100px"}}>Preço</th>
                        <th style={{width: "150px"}}>Total</th>
                        <th style={{width: "20px"}}>{/* options */}</th>
                    </tr>
                    </thead>
                    <tbody className='products-table'>
                    {cart ? cart.map((cartProduct, key) =>
                        <tr key={key} className='products-table__item'>
                            <td className="products-table__item__quantity" style={{width: "85px", textAlign: 'center'}}>
                                <IconButton color="primary" aria-label="reduce quantity"
                                            onClick={() => decreaseQuantity(cartProduct)}>
                                    <RemoveIcon/>
                                </IconButton>
                                {cartProduct.quantity}
                                <IconButton color="primary" aria-label="increase quantity"
                                            onClick={() => increaseQuantity(cartProduct)}>
                                    <AddIcon/>
                                </IconButton>
                            </td>
                            <td style={{width: "175px"}}><p className="products-table__item__name">{cartProduct.name}</p></td>
                            <td style={{width: "80px"}}>{(cartProduct.price / 100).toFixed(2)}€</td>
                            <td style={{width: "80px"}}>{(cartProduct.totalAmount / 100).toFixed(2)}€</td>
                            <td style={{width: "50px"}}>
                                <IconButton
                                    color="error"
                                    aria-label="delete"
                                    onClick={() => removeProduct(cartProduct)}>
                                    <DeleteIcon/>
                                </IconButton>
                            </td>
                        </tr>) : 'No Item in Cart'}
                    </tbody>
                </table>
            </div>
            <h2 className='p-4 bg-dark text-white'>Total: {(totalAmount / 100).toFixed(2)}€</h2>

            <div className=''>
                <Button variant="contained" fullWidth
                        size="large" disabled={totalAmount === 0} onClick={handlePayment}>
                    Pagar
                </Button>
            </div>
        </div>
    )
}