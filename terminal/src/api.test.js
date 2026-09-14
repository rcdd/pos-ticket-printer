import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {api, ApiError, newRequestId, setToken, getToken, setUnauthorizedHandler} from './api.js';

const mockResponse = ({status = 200, body = null, headers = {}} = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {get: (name) => headers[name.toLowerCase()] ?? null},
    text: async () => (body === null ? '' : JSON.stringify(body)),
});

// localStorage does not exist in a node environment — minimal stub
const store = new Map();
beforeEach(() => {
    globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => store.delete(k),
    };
    store.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('api()', () => {
    it('sends the token and renews it from the header', async () => {
        setToken('token-antigo');
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({
            body: {ok: true},
            headers: {'x-auth-token': 'token-novo'},
        }));

        const data = await api('/orders');
        expect(data).toEqual({ok: true});
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-antigo');
        expect(getToken()).toBe('token-novo');
    });

    it('API errors become ApiError with the server message', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({
            status: 409,
            body: {message: 'Não existe nenhuma sessão de caixa aberta.'},
        }));

        await expect(api('/order', {method: 'POST', body: {}})).rejects.toMatchObject({
            status: 409,
            message: 'Não existe nenhuma sessão de caixa aberta.',
        });
    });

    it('token 401 clears the session and calls the handler', async () => {
        setToken('expirado');
        const onUnauthorized = vi.fn();
        setUnauthorizedHandler(onUnauthorized);
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({
            status: 401,
            body: {message: 'Token inválido', code: 'AUTH_TOKEN_INVALID'},
        }));

        await expect(api('/orders')).rejects.toBeInstanceOf(ApiError);
        expect(getToken()).toBe(null);
        expect(onUnauthorized).toHaveBeenCalled();
    });

    it('business 401 (e.g. wrong admin credentials) does NOT log out', async () => {
        setToken('valido');
        const onUnauthorized = vi.fn();
        setUnauthorizedHandler(onUnauthorized);
        globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({
            status: 401,
            body: {message: 'Credenciais de administrador inválidas.'},
        }));

        await expect(api('/order/1/cancel-items', {method: 'POST', body: {}})).rejects.toMatchObject({status: 401});
        expect(getToken()).toBe('valido');
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('network failure yields a friendly message', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(api('/orders')).rejects.toMatchObject({
            status: 0,
            message: 'Sem ligação ao servidor. Verifique o Wi-Fi.',
        });
    });
});

describe('newRequestId', () => {
    it('generates unique ids', () => {
        const ids = new Set(Array.from({length: 50}, () => newRequestId()));
        expect(ids.size).toBe(50);
    });
});
