// Rate-limit simples em memória para o login: protege as passwords de
// tentativas repetidas vindas da rede local. Sem dependências externas.
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map(); // key -> [timestamps]

const keyFor = (req) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    return `${req.ip}|${username}`;
};

const prune = (list, now) => list.filter((ts) => now - ts < WINDOW_MS);

export function loginRateLimit(req, res, next) {
    const now = Date.now();
    const key = keyFor(req);
    const recent = prune(attempts.get(key) ?? [], now);

    if (recent.length >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).send({
            message: `Demasiadas tentativas de início de sessão. Tente novamente dentro de ${retryAfter}s.`,
        });
    }

    recent.push(now);
    attempts.set(key, recent);

    // Login com sucesso limpa o contador
    const originalSend = res.send.bind(res);
    res.send = (body) => {
        if (res.statusCode === 200) {
            attempts.delete(key);
        }
        return originalSend(body);
    };

    next();
}
