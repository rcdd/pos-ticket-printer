import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <App />
);

window.onerror = function (message, source, lineno, colno, error) {
    console.error("Erro global:", { message, source, lineno, colno, error });
    alert("Erro: " + message);
};

window.addEventListener('unhandledrejection', function (event) {
    console.error("Promise rejeitada sem catch:", event.reason);
    alert("Erro: " + event.reason);
});

