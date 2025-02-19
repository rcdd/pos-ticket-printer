import React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Button from '@mui/material/Button';

function HomePage() {
    const nav = useNavigate();

    const handleSetup = () => {
        const pass = prompt("Password:", "")
        if (pass !== null) {
            if (pass === "admin") {
                nav("/admin");
            } else {
                alert("Wrong Password");
            }
        }
    }

    return (
        <MainLayout>
            <div className='bg-light p-5 mt-4 rounded-3'>
                <h1>Bem-vindo ao sistema simples de talões POS</h1>
                <p>Qualquer dúvida ou informação contactar <a
                    href="https://github.com/rcdd/" rel="noreferrer" target="_blank">Ruben Domingues</a> através do número
                    918182831 ou email <a href="mailto:geral@rubendomingues.pt">geral@rubendomingues.pt</a>
                </p>
                <p>👇 Clique no botão seguinte "Iniciar" para abrir a aplicação.</p>
                <Link to='/pos' className='btn btn-primary btn-lg'>Iniciar</Link>
                <p></p>
                <Button onClick={handleSetup} variant="outlined">Administração</Button>
            </div>
        </MainLayout>
    )
}

export default HomePage
