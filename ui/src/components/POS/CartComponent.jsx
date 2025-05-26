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
                        <td width={"20%"} align={"center"}>Qtd</td>
                        <td width={"35%"}>Item</td>
                        <td width={"20%"}>Preço</td>
                        <td width={"15%"}>Total</td>
                        <td width={"10%"}>{/* options */}</td>
                    </tr>
                    </thead>
                    <tbody className='products-table'>
                    {cart ? cart.map((cartProduct, key) =>
                        <tr key={key} className='products-table__item'>
                            <td className="products-table__item__quantity" width={"18%"} align={"center"}>
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
                            <td width={"35%"}><p className="products-table__item__name">{cartProduct.name}</p></td>
                            <td width={"20%"}>{(cartProduct.price / 100).toFixed(2)}€</td>
                            <td width={"15%"}>{(cartProduct.totalAmount / 100).toFixed(2)}€</td>
                            <td width={"10%"}>
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
                <Button variant="contained" fullWidth={true}
                        size="large" disabled={totalAmount === 0} onClick={handlePayment}>
                    Pagar
                </Button>
            </div>
        </div>
    )
}