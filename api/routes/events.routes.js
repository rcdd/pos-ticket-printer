import {Router} from 'express';
import {subscribe} from '../services/events.service.js';

const router = Router();

// Server-Sent Events: terminais e caixa recebem atualizações sem polling.
// A autenticação vem em ?token= (o EventSource não permite headers) e é
// validada pelo middleware authenticate montado antes desta rota.
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: hello\ndata: {"connectedAt":${Date.now()}}\n\n`);

    const unsubscribe = subscribe((event) => {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    });

    // keep-alive: alguns proxies/browsers fecham ligações silenciosas
    const ping = setInterval(() => {
        res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(ping);
        unsubscribe();
    });
});

export default router;
