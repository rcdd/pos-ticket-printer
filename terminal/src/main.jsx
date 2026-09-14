import {render} from 'preact';
import {App} from './app.jsx';
import './styles.css';

render(<App/>, document.getElementById('app'));

// PWA: register the service worker (production only — it gets in HMR's way in dev)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/terminal/sw.js').catch(() => {
        });
    });
}
