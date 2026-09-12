import {render} from 'preact';
import {App} from './app.jsx';
import './styles.css';

render(<App/>, document.getElementById('app'));

// PWA: regista o service worker (só em produção — em dev atrapalha o HMR)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/terminal/sw.js').catch(() => {
        });
    });
}
