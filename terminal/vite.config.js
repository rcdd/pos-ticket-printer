import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';

// Em produção a app é servida pela própria API em /terminal (mesma origem).
// Em dev, o proxy encaminha as chamadas para a API local.
const API_PATHS = [
    '/user', '/users', '/order', '/orders', '/table', '/tables',
    '/zones', '/menus', '/db', '/option', '/license', '/session', '/sessions',
    '/system', '/events', '/health', '/printer', '/invoice', '/reports',
];

export default defineConfig({
    plugins: [preact()],
    base: '/terminal/',
    build: {
        target: 'es2018',
        outDir: 'dist',
    },
    server: {
        proxy: Object.fromEntries(API_PATHS.map((path) => [path, {
            target: process.env.VITE_API_TARGET || 'http://localhost:9393',
            changeOrigin: true,
        }])),
    },
    test: {
        environment: 'node',
    },
});
