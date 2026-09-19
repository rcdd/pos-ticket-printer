import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {api, clearSession, getStoredUser, getToken, setStoredUser, setUnauthorizedHandler} from './api.js';
import {notifyCatalogUpdated} from './views/OrderBuilder.jsx';
import {Login} from './views/Login.jsx';
import {Home} from './views/Home.jsx';
import {OrderBuilder} from './views/OrderBuilder.jsx';
import {OrderSent} from './views/OrderSent.jsx';
import {TableView} from './views/TableView.jsx';

export function App() {
    const [user, setUser] = useState(getStoredUser());
    const [screen, setScreen] = useState({name: getToken() ? 'home' : 'login'});
    const [status, setStatus] = useState({loading: true, multi: false, sessionOpen: false, licenseValid: false});

    // ephemeral success banner (e.g. "Pedido #031 enviado")
    const [flash, setFlash] = useState(null);
    const flashTimer = useRef(null);
    const showFlash = useCallback((text) => {
        setFlash(text);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 4000);
    }, []);

    // Navigation integrated with browser history: the phone's hardware
    // back button navigates inside the app (table → home) instead of
    // closing the browser. Each screen is a history entry.
    const go = useCallback((next) => {
        setScreen(next);
        try {
            window.history.pushState(next, '');
        } catch {
        }
    }, []);

    // replaces the current entry (login/logout must not stay in history)
    const goReplace = useCallback((next) => {
        setScreen(next);
        try {
            window.history.replaceState(next, '');
        } catch {
        }
    }, []);

    const goBack = useCallback(() => {
        window.history.back();
    }, []);

    // Navigation guard: a screen can block "back" (hardware or browser)
    // to show a confirmation — e.g. an order with unsent items.
    const navGuard = useRef(null);
    const screenRef = useRef(screen);
    screenRef.current = screen;

    const registerBackGuard = useCallback((fn) => {
        navGuard.current = fn;
    }, []);

    useEffect(() => {
        try {
            window.history.replaceState({name: getToken() ? 'home' : 'login'}, '');
        } catch {
        }
        const onPop = (event) => {
            // the browser already popped; if the guard blocks, we re-push the
            // entry and the screen shows the confirmation — if the user
            // confirms, the continuation performs back again (guard disarmed)
            if (typeof navGuard.current === 'function'
                && navGuard.current(() => window.history.back())) {
                try {
                    window.history.pushState(screenRef.current, '');
                } catch {
                }
                return;
            }
            setScreen(event.state?.name ? event.state : {name: 'home'});
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setUser(null);
        goReplace({name: 'login'});
    }, [goReplace]);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            setUser(null);
            goReplace({name: 'login'});
        });
    }, [goReplace]);

    const refreshStatus = useCallback(async () => {
        try {
            const data = await api('/system/terminal-status');
            setStatus({loading: false, ...data});
            return data;
        } catch {
            setStatus((prev) => ({...prev, loading: false}));
            return null;
        }
    }, []);

    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, 30000);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    // Realtime: SSE signals order/table/session changes and the views
    // reload via liveTick (polling stays as a fallback).
    const [liveTick, setLiveTick] = useState(0);
    useEffect(() => {
        if (!user) return;
        let source = null;
        let retry = null;
        let stopped = false;
        let catalogDebounce = null;

        const connect = () => {
            const token = getToken();
            if (!token || stopped) return;
            source = new EventSource(`/events?token=${encodeURIComponent(token)}`);
            const bump = () => setLiveTick((tick) => tick + 1);
            source.addEventListener('order.created', bump);
            source.addEventListener('order.updated', bump);
            source.addEventListener('table.updated', bump);
            source.addEventListener('session.updated', () => {
                refreshStatus();
                bump();
            });
            // product/zone/menu edits at the register: refresh mounted
            // catalogs in place (debounced — imports fire bursts of these)
            source.addEventListener('catalog.updated', () => {
                clearTimeout(catalogDebounce);
                catalogDebounce = setTimeout(notifyCatalogUpdated, 800);
            });
            source.onerror = () => {
                source.close();
                if (!stopped) retry = setTimeout(connect, 5000);
            };
        };

        connect();
        return () => {
            stopped = true;
            if (source) source.close();
            if (retry) clearTimeout(retry);
            if (catalogDebounce) clearTimeout(catalogDebounce);
        };
    }, [user, refreshStatus]);

    // Validate the stored session on boot
    useEffect(() => {
        if (!getToken()) return;
        api('/user/me')
            .then((data) => {
                setUser(data);
                setStoredUser(data);
            })
            .catch(() => {
            });
    }, []);

    const onLogin = (loggedUser) => {
        setUser(loggedUser);
        setStoredUser(loggedUser);
        goReplace({name: 'home'});
        refreshStatus();
    };

    const goHome = () => {
        // "Início" honors the guard too; on confirm, proceed to home
        if (typeof navGuard.current === 'function'
            && navGuard.current(() => go({name: 'home'}))) {
            return;
        }
        go({name: 'home'});
    };

    let banner = null;
    if (!status.loading && !status.multi) {
        banner = <div class="banner error">O modo multiposto não está ativo. Fale com o administrador.</div>;
    } else if (!status.loading && !status.sessionOpen) {
        banner = <div class="banner warning">A caixa está fechada — não é possível registar pedidos.</div>;
    }

    const canOrder = Boolean(status.multi && status.sessionOpen);

    let view = null;
    if (screen.name === 'login' || !user) {
        view = <Login onLogin={onLogin}/>;
    } else if (screen.name === 'home') {
        view = (
            <Home
                liveTick={liveTick}
                canOrder={canOrder}
                onNewStandalone={() => go({name: 'order', table: null})}
                onOpenTable={(table) => go({name: 'order', table})}
                onNewTable={(table) => go({name: 'order', table})}
            />
        );
    } else if (screen.name === 'order') {
        view = (
            <OrderBuilder
                table={screen.table}
                canOrder={canOrder}
                onCancel={goBack}
                registerBackGuard={registerBackGuard}
                onViewTable={screen.table ? () => go({name: 'table', tableId: screen.table.id}) : null}
                onSent={(result) => {
                    if (result.printed) {
                        const num = `#${String(result.order?.number ?? 0).padStart(3, '0')}`;
                        const where = screen.table ? ` · Mesa ${screen.table.displayName || screen.table.number}` : '';
                        showFlash(`✅ Pedido ${num} enviado${where} · talão impresso`);
                        window.history.back();
                    } else {
                        goReplace({name: 'sent', result, table: screen.table});
                    }
                }}
            />
        );
    } else if (screen.name === 'sent') {
        view = (
            <OrderSent
                result={screen.result}
                table={screen.table}
                onNewOrder={() => go({name: 'order', table: screen.table})}
                onViewTable={screen.table ? () => go({name: 'table', tableId: screen.table.id}) : null}
                onHome={goHome}
            />
        );
    } else if (screen.name === 'table') {
        view = (
            <TableView
                liveTick={liveTick}
                tableId={screen.tableId}
                currentUser={user}
                onBack={goBack}
                onClosed={goHome}
            />
        );
    }

    return (
        <>
            <div class="topbar">
                <span class="title">
                    {user ? `TicketPrint · ${user.name || user.username}` : 'TicketPrint Terminal'}
                </span>
                {user && screen.name !== 'home' && (
                    <button onClick={goHome}>Início</button>
                )}
                {user && <button onClick={logout}>Sair</button>}
            </div>
            {user && flash && <div class="banner success">{flash}</div>}
            {user && banner}
            {view}
        </>
    );
}
