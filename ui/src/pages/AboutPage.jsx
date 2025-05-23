import * as React from 'react';

export default function AboutPage() {

    return (
        <div className='bg-light p-5 mt-4 rounded-3'>
            <h1>Bem-vindo ao Sistema Simples de Talões POS</h1>

            <p>Esta aplicação foi desenvolvida com o objetivo de simplificar o processo de venda de produtos.</p>

            <p>Contudo, importa salientar que este sistema <strong>não constitui uma solução de faturação
                certificada </strong>
                nem está homologado pelas autoridades fiscais. Por isso, não deverá ser utilizado para efeitos legais ou
                de
                fiscalização.</p>

            <p>O sistema encontra-se em constante evolução, com melhorias e novas funcionalidades a serem implementadas
                regularmente. A tua opinião é muito importante para continuar a melhorar a aplicação.</p>

            <br/>
            <p className="lead">
                Em caso de dúvida ou para enviar sugestões, entra em contacto com <a
                href="https://github.com/rcdd/" rel="noreferrer" target="_blank">Ruben Domingues</a> através do número
                <strong> 918 182 831</strong> ou pelo email <a
                href="mailto:geral@rubendomingues.pt">geral@rubendomingues.pt</a>.
            </p>
        </div>
    );
}
