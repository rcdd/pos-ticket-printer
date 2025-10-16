import * as React from 'react';

const contactItems = [
    {
        label: "Email",
        value: "geral@rubendomingues.pt",
        href: "mailto:geral@rubendomingues.pt",
    },
    {
        label: "Telefone",
        value: "918 182 831",
        href: "tel:+351918182831",
    },
    {
        label: "GitHub",
        value: "github.com/rcdd",
        href: "https://github.com/rcdd/",
    },
];

export default function AboutPage() {
    return (
        <section className="about">
            <div className="about__card">
                <header className="about__header">
                    <span className="about__tag">Informação</span>
                    <h1 className="about__title">TicketPrint POS</h1>
                    <p className="about__subtitle">
                        Gestão simples de talões e impressões para pontos de venda.
                    </p>
                </header>

                <div className="about__content">
                    <p>
                        O TicketPrint foi pensado para restaurantes, cafés e bares que precisam de um fluxo de
                        impressão rápido e orientado para operações do dia-a-dia. Organiza menus, imprime talões e
                        acompanha sessões em poucos cliques.
                    </p>

                    <div className="about__highlight">
                        <strong>Aviso legal</strong>
                        <p>
                            Esta aplicação não é uma solução de faturação certificada e não se encontra homologada
                            pelas autoridades fiscais. Utilize-a apenas para controlo interno ou como complemento aos
                            seus sistemas oficiais.
                        </p>
                    </div>

                    <p>
                        Estamos a iterar continuamente com base no feedback da operação real. A tua opinião é essencial
                        para que possamos priorizar melhorias que simplificam o trabalho da tua equipa.
                    </p>
                </div>

                <footer className="about__footer">
                    <h2>Fala connosco</h2>
                    <p>Partilha dúvidas, sugestões ou pedidos de integração:</p>
                    <ul className="about__contact-list">
                        {contactItems.map((item) => (
                            <li key={item.label}>
                                <span>{item.label}</span>
                                <a href={item.href} target={item.href.startsWith('http') ? "_blank" : undefined} rel="noreferrer">
                                    {item.value}
                                </a>
                            </li>
                        ))}
                    </ul>
                </footer>
            </div>
        </section>
    );
}
