import {useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {api, newRequestId} from '../api.js';
import {centsToEuros, cartTotal} from '../money.js';
import {themeStyle} from '../themes.js';

const MENUS_TAB = '__menus__';

// Simple catalog cache — avoids re-downloading on every order
let catalogCache = null;
const catalogListeners = new Set();

async function loadCatalog() {
    if (catalogCache) return catalogCache;
    const [zones, products, menus] = await Promise.all([
        api('/zones'),
        api('/db/products'),
        api('/menus'),
    ]);
    catalogCache = {zones, products, menus};
    return catalogCache;
}

export const invalidateCatalog = () => {
    catalogCache = null;
};

// Called from the SSE handler when the register edits products/zones/menus:
// mounted builders re-fetch and reconcile their state without any refresh.
export const notifyCatalogUpdated = () => {
    catalogCache = null;
    for (const listener of catalogListeners) listener();
};

const cartKey = (item) => (item.menuId ? `m${item.menuId}` : `p${item.productId}`);

export function OrderBuilder({table, canOrder, onCancel, onSent, onViewTable, registerBackGuard}) {
    const [catalog, setCatalog] = useState(null);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState(null);
    const [cart, setCart] = useState([]); // [{productId|menuId, name, price, quantity}]
    const [note, setNote] = useState('');
    const [showCart, setShowCart] = useState(false);
    const [sending, setSending] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [requestId] = useState(newRequestId);

    // Cart draft in sessionStorage: survives an accidental page refresh
    // (safety net on top of the CSS pull-to-refresh block).
    const draftKey = table ? `tp_draft_table_${table.id}` : 'tp_draft_standalone';

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(draftKey);
            if (raw) {
                const draft = JSON.parse(raw);
                if (Array.isArray(draft.cart) && draft.cart.length) setCart(draft.cart);
                if (draft.note) setNote(draft.note);
            }
        } catch {
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        try {
            if (cart.length || note) {
                sessionStorage.setItem(draftKey, JSON.stringify({cart, note}));
            } else {
                sessionStorage.removeItem(draftKey);
            }
        } catch {
        }
    }, [cart, note, draftKey]);

    const clearDraft = () => {
        try {
            sessionStorage.removeItem(draftKey);
        } catch {
        }
    };

    // back arrow: with unsent items, ask for confirmation (accidental tap)
    const handleBack = () => {
        if (cart.length > 0) {
            setConfirmLeave(true);
        } else {
            clearDraft();
            onCancel();
        }
    };

    // same guard for the phone/browser hardware back and for "Início":
    // blocks navigation, shows the confirmation and stores the continuation
    // (where the user was heading) to resume it if they confirm
    const cartCountRef = useRef(0);
    cartCountRef.current = cart.length;
    const pendingNavRef = useRef(null);

    useEffect(() => {
        if (typeof registerBackGuard !== 'function') return undefined;
        registerBackGuard((proceed) => {
            if (cartCountRef.current > 0) {
                pendingNavRef.current = proceed ?? null;
                setConfirmLeave(true);
                return true; // block; the confirmation decides
            }
            return false;
        });
        return () => registerBackGuard(null);
    }, [registerBackGuard]);

    const closeConfirmLeave = () => {
        pendingNavRef.current = null;
        setConfirmLeave(false);
    };

    const discardAndLeave = () => {
        if (typeof registerBackGuard === 'function') {
            registerBackGuard(null); // disarm the guard: now we really leave
        }
        clearDraft();
        const proceed = pendingNavRef.current;
        pendingNavRef.current = null;
        if (proceed) {
            proceed(); // resume the original navigation (hardware back or Início)
        } else {
            onCancel(); // veio da seta "←" da app
        }
    };

    // bottom-sheet drag-to-close (on the handle/header)
    const [dragY, setDragY] = useState(0);
    const [draggingSheet, setDraggingSheet] = useState(false);
    const touchStartY = useRef(null);
    const wasDragged = useRef(false); // keeps the post-drag click from closing the sheet

    const onSheetTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
        wasDragged.current = false;
        setDraggingSheet(true);
    };
    const onSheetTouchMove = (e) => {
        if (touchStartY.current === null) return;
        const dy = Math.max(0, e.touches[0].clientY - touchStartY.current);
        if (dy > 8) wasDragged.current = true;
        setDragY(dy);
    };
    const onSheetTouchEnd = (e) => {
        setDraggingSheet(false);
        if (wasDragged.current) {
            // kill the "ghost click" the browser fires right after a drag
            // (it would land on the "Rever pedido" button and scramble state)
            e.preventDefault();
        }
        if (dragY > 90 && !sending) {
            setShowCart(false);
        }
        setDragY(0);
        touchStartY.current = null;
        wasDragged.current = false;
    };
    const onSheetGrabClick = () => {
        if (!sending) setShowCart(false);
    };

    useEffect(() => {
        loadCatalog()
            .then((data) => {
                setCatalog(data);
                const firstZone = [...data.zones].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
                setTab(firstZone ? firstZone.id : (data.menus.length ? MENUS_TAB : null));
            })
            .catch((err) => setError(err.message));
    }, []);

    // Live catalog updates from the register: refresh the grid in place and
    // reconcile the cart — names/prices follow, removed products are dropped
    // with a visible notice. The in-progress order is never lost (and prices
    // are resolved server-side at creation anyway).
    const [catalogNotice, setCatalogNotice] = useState(null);
    useEffect(() => {
        const listener = () => {
            loadCatalog()
                .then((data) => {
                    setCatalog(data);
                    setTab((current) => {
                        if (current === MENUS_TAB) return data.menus.length ? current : null;
                        if (current !== null && data.zones.some((zone) => zone.id === current)) return current;
                        const firstZone = [...data.zones].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
                        return firstZone ? firstZone.id : (data.menus.length ? MENUS_TAB : null);
                    });
                    setCart((prev) => {
                        const removed = [];
                        const next = prev.map((item) => {
                            const source = item.menuId
                                ? data.menus.find((menu) => menu.id === item.menuId)
                                : data.products.find((product) => product.id === item.productId);
                            if (!source || source.isDeleted) {
                                removed.push(item.name);
                                return null;
                            }
                            return {...item, name: source.name, price: source.price ?? 0};
                        }).filter(Boolean);
                        setCatalogNotice(removed.length
                            ? `Produtos atualizados — removido do pedido (indisponível): ${removed.join(', ')}`
                            : 'Produtos atualizados.');
                        return next;
                    });
                })
                .catch(() => {});
        };
        catalogListeners.add(listener);
        return () => catalogListeners.delete(listener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!catalogNotice) return undefined;
        const timer = setTimeout(() => setCatalogNotice(null), 5000);
        return () => clearTimeout(timer);
    }, [catalogNotice]);

    const zonesSorted = useMemo(
        () => (catalog ? [...catalog.zones].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : []),
        [catalog],
    );

    const visibleItems = useMemo(() => {
        if (!catalog || tab === null) return [];
        if (tab === MENUS_TAB) {
            return catalog.menus.map((menu) => ({
                menuId: menu.id, name: menu.name, price: menu.price ?? 0, theme: 'black',
            }));
        }
        return catalog.products
            .filter((product) => product.zoneId === tab)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((product) => ({
                productId: product.id, name: product.name, price: product.price ?? 0, theme: product.theme,
            }));
    }, [catalog, tab]);

    const quantities = useMemo(() => {
        const map = new Map();
        for (const item of cart) map.set(cartKey(item), item.quantity);
        return map;
    }, [cart]);

    const addItem = (item) => {
        setCart((prev) => {
            const key = cartKey(item);
            const existing = prev.find((entry) => cartKey(entry) === key);
            if (existing) {
                return prev.map((entry) => cartKey(entry) === key
                    ? {...entry, quantity: entry.quantity + 1}
                    : entry);
            }
            return [...prev, {...item, quantity: 1}];
        });
    };

    const changeQty = (key, delta) => {
        setCart((prev) => prev
            .map((entry) => cartKey(entry) === key ? {...entry, quantity: entry.quantity + delta} : entry)
            .filter((entry) => entry.quantity > 0));
    };

    const total = cartTotal(cart);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    const send = async () => {
        if (sending || cart.length === 0) return;
        setSending(true);
        setError(null);
        try {
            const result = await api('/order', {
                method: 'POST',
                body: {
                    tableId: table?.id ?? null,
                    note: note.trim() || undefined,
                    clientRequestId: requestId,
                    items: cart.map((item) => ({
                        productId: item.productId ?? undefined,
                        menuId: item.menuId ?? undefined,
                        quantity: item.quantity,
                    })),
                },
            });
            clearDraft();
            setCart([]);
            if (typeof registerBackGuard === 'function') {
                registerBackGuard(null);
            }
            onSent(result);
        } catch (err) {
            setError(err.message);
            setSending(false);
        }
    };

    if (error && !catalog) {
        return (
            <div class="screen">
                <p class="error-text">{error}</p>
                <button class="btn secondary" onClick={onCancel}>Voltar</button>
            </div>
        );
    }

    if (!catalog) return <div class="screen"><div class="spinner"/></div>;

    return (
        <div class="screen">
            <div class="page-header">
                <button class="back-btn" aria-label="Voltar" onClick={handleBack}>←</button>
                <h3 style="margin:0; flex:1; display:flex; align-items:center; gap:8px">
                    {table ? (
                        <>
                            <span style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Mesa</span>
                            <span class="table-badge">{table.displayName || table.number}</span>
                        </>
                    ) : 'Pedido avulso'}
                </h3>
                {table && onViewTable && (
                    <button class="header-action" onClick={onViewTable}>
                        Conta 🧾
                    </button>
                )}
            </div>

            {catalogNotice && (
                <div class="catalog-notice" role="status">{catalogNotice}</div>
            )}

            <div class="tabs">
                {zonesSorted.map((zone) => (
                    <button key={zone.id} class={tab === zone.id ? 'active' : ''} onClick={() => setTab(zone.id)}>
                        {zone.name}
                    </button>
                ))}
                {catalog.menus.length > 0 && (
                    <button class={tab === MENUS_TAB ? 'active' : ''} onClick={() => setTab(MENUS_TAB)}>
                        Menus
                    </button>
                )}
            </div>

            {visibleItems.length === 0 ? (
                <p class="muted">Sem produtos nesta zona.</p>
            ) : (
                <div class="grid">
                    {visibleItems.map((item) => {
                        const qty = quantities.get(cartKey(item)) ?? 0;
                        return (
                            <div class="tile-wrap" key={cartKey(item)}>
                                <button class="tile" style={themeStyle(item.theme)} onClick={() => addItem(item)}>
                                    <span class="label">{item.name}</span>
                                    <span class="price">{centsToEuros(item.price)}</span>
                                </button>
                                {qty > 0 && <span class="qty-badge">{qty}</span>}
                            </div>
                        );
                    })}
                </div>
            )}

            {showCart && (
                <>
                    <div class="sheet-backdrop" onClick={() => !sending && setShowCart(false)}/>
                    <div
                        class="sheet"
                        role="dialog"
                        aria-label="Pedido"
                        style={{
                            transform: dragY ? `translateY(${dragY}px)` : 'translateY(0)',
                            transition: draggingSheet ? 'none' : 'transform 180ms ease',
                        }}
                    >
                        <div
                            class="sheet-grab"
                            onTouchStart={onSheetTouchStart}
                            onTouchMove={onSheetTouchMove}
                            onTouchEnd={onSheetTouchEnd}
                            onClick={onSheetGrabClick}
                        >
                            <div class="sheet-handle"/>
                            <div class="sheet-header">
                                <h3 style="margin:0">{table ? `Pedido — Mesa ${table.displayName || table.number}` : 'Pedido avulso'}</h3>
                                <span class="muted">{count} {count === 1 ? 'item' : 'itens'}</span>
                            </div>
                        </div>

                        <div class="sheet-body">
                            {cart.map((item) => {
                                const key = cartKey(item);
                                return (
                                    <div class="line" key={key}>
                                        <span class="name">{item.name}</span>
                                        <div class="qty-controls">
                                            <button onClick={() => changeQty(key, -1)}>−</button>
                                            <span class="qty">{item.quantity}</span>
                                            <button onClick={() => changeQty(key, 1)}>+</button>
                                        </div>
                                        <span>{centsToEuros(item.price * item.quantity)}</span>
                                    </div>
                                );
                            })}
                            <div style="margin-top:10px">
                                <input
                                    placeholder="Observações (ex.: sem gelo)"
                                    value={note}
                                    onInput={(e) => setNote(e.currentTarget.value)}
                                />
                            </div>
                            {error && <p class="error-text" style="margin-top:8px">{error}</p>}
                        </div>

                        <div class="sheet-footer">
                            <button class="btn" style="flex:1; background:var(--success)"
                                    disabled={!canOrder || sending || cart.length === 0}
                                    onClick={send}>
                                {sending ? 'A enviar…' : `Enviar pedido · ${centsToEuros(total)}`}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {confirmLeave && (
                <>
                    <div class="sheet-backdrop" onClick={closeConfirmLeave}/>
                    <div class="confirm-card" role="alertdialog" aria-label="Descartar pedido?">
                        <h3 style="margin:0 0 6px">Descartar o pedido?</h3>
                        <p class="muted" style="margin:0 0 14px">
                            Tens {count} {count === 1 ? 'item' : 'itens'} por enviar ({centsToEuros(total)}).
                            Se saíres agora, o pedido é descartado.
                        </p>
                        <div style="display:flex; flex-direction:column; gap:8px">
                            <button class="btn" onClick={closeConfirmLeave}>
                                Continuar no pedido
                            </button>
                            <button class="btn danger" onClick={discardAndLeave}>
                                Sair e descartar
                            </button>
                        </div>
                    </div>
                </>
            )}

            <div class="cartbar">
                <span class="total">{count} {count === 1 ? 'item' : 'itens'} · {centsToEuros(total)}</span>
                <button disabled={cart.length === 0} onClick={() => setShowCart(true)}>
                    Rever pedido
                </button>
            </div>
        </div>
    );
}
