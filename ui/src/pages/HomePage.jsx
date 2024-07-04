import React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Button from '@mui/material/Button';

function HomePage() {
    const nav = useNavigate();

    const handleSetup = () => {
        const pass = prompt("Password:", "")
        if (pass !==  null) {
            if (pass === "admin") {
                nav("/setup");
            } else {
                alert("Wrong Password");
            }
        }
    }

    return (
        <MainLayout>
            <div className='bg-light p-5 mt-4 rounded-3'>
                <h1>Welcome to the simple POS for small business</h1>
                <p>If you have an issue, reach out to me on <a
                    href="https://github.com/rcdd/" rel="noreferrer" target="_blank">Ruben Domingues</a>
                </p>
                <Link to='/pos' className='btn btn-primary'>Iniciar</Link>
                <p></p>
                <Button onClick={handleSetup} variant="outlined">Setup</Button>
            </div>
        </MainLayout>
    )
}

export default HomePage
