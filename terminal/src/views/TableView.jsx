import {useCallback, useEffect, useState} from 'preact/hooks';
import {api} from '../api.js';
import {centsToEuros} from '../money.js';
import {PasswordInput} from './PasswordInput.jsx';

const formatNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;
const STATUS_LABEL = {sent: 'Por pagar', paid: 'Pago', cancelled: 'Anulado'};

// Voiding an item requires admin approval (the waiter hands the phone to
// the person in charge, who types their own credentials).
function CancelItemDialog({order, item, currentUser, onDone, onClose}) {
    const isAdmin = currentUser?.role === 'admin';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const confirm = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const body = {itemIds: [item.id]};
            if (!isAdmin) {
                body.adminUsername = username;
                body.adminPassword = password;
            }
            const result = await api(`/order/${order.id}/cancel-items`, {method: 'POST', body});
            onDone(result);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    };

    return (
        <>
            <div class="sheet-backdrop" onClick={() => !busy && onClose()}/>
            <div class="card" style="position:fixed; inset:auto 14px 14px; z-index:41; box-shadow:0 -4px 24px rgba(0,0,0,0.25)">
                <h3>Anular item</h3>
                <p style="margin:4px 0 10px">
                    Pedido #{String(order.number).padStart(3, '0')} — <b>{item.quantity}x {item.nameSnapshot}</b>
                </p>
                {isAdmin ? (
                    <p class="muted">Vai ser impresso um talão de anulação para a cozinha.</p>
                ) : (
                    <>
                        <p class="muted" style="margin-bottom:8px">Requer aprovação de um administrador:</p>
                        <div style="display:flex; flex-direction:column; gap:8px">
                            <input placeholder="Utilizador admin" autocapitalize="none" value={username}
                                   onInput={(e) => setUsername(e.currentTarget.value)}/>
                            <PasswordInput value={password}
                                           onInput={(e) => setPassword(e.currentTarget.value)}/>
                        </div>
                    </>
                )}
                {error && <p class="error-text" style="margin-top:8px">{error}</p>}
                <div style="display:flex; gap:8px; margin-top:12px">
                    <button class="btn secondary" onClick={onClose} disabled={busy}>Voltar</button>
                    <button class="btn danger" onClick={confirm}
                            disabled={busy || (!isAdmin && (!username || !password))}>
                        {busy ? 'A anular…' : 'Anular item'}
                    </button>
                </div>
            </div>
        </>
    );
}

export function TableView({liveTick, tableId, currentUser, onBack, onClosed}) {
    const [table, setTable] = useState(null);
    const [error, setError] = useState(null);
    const [closing, setClosing] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null); // {order, item}
    const [notice, setNotice] = useState(null);

    const load = useCallback(async () => {
        try {
            setTable(await api(`/table/${tableId}`));
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [tableId]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000); // fallback; SSE handles realtime
        return () => clearInterval(interval);
    }, [load, liveTick]);

    const closeEmpty = async () => {
        if (closing) return;
        setClosing(true);
        try {
            await api(`/table/${tableId}/close-empty`, {method: 'POST'});
            // the tab no longer exists — go home, not to the previous screen
            (onClosed ?? onBack)();
        } catch (err) {
            setError(err.message);
        } finally {
            setClosing(false);
        }
    };

    if (!table) {
        return (
            <div class="screen">
                {error ? <p class="error-text">{error}</p> : <div class="spinner"/>}
            </div>
        );
    }

    const orders = table.orders ?? [];
    const hasUnpaid = orders.some((order) => order.status === 'sent');
    const isClosed = table.status === 'closed';

    return (
        <div class="screen">
            <div class="page-header">
                <button class="back-btn" aria-label="Voltar" onClick={onBack}>←</button>
                <h2 style="margin:0; flex:1; display:flex; align-items:center; gap:8px">
                    <span style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Mesa</span>
                    <span class="table-badge">{table.displayName || table.number}</span>
                </h2>
                <span class="muted">{isClosed ? 'Fechada' : `Por pagar: ${centsToEuros(table.unpaidTotal)}`}</span>
            </div>
            {table.openedBy && (
                <p class="muted" style="margin:-6px 0 12px">
                    Conta aberta por <b>{table.openedBy.name || table.openedBy.username}</b>
                </p>
            )}

            {error && <p class="error-text">{error}</p>}

            {orders.length === 0 ? (
                <p class="muted">Ainda não há pedidos nesta mesa.</p>
            ) : (
                orders.map((order) => (
                    <div class="card" style="margin-bottom:10px" key={order.id}>
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
                            <strong>Pedido {formatNumber(order.number)}</strong>
                            <span class="muted" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                                {order.user ? (order.user.name || order.user.username) : ''}
                            </span>
                            <span class="muted">{STATUS_LABEL[order.status] ?? order.status}</span>
                        </div>
                        {(order.items ?? []).map((item) => (
                            <div class="line" key={item.id}>
                                <span class={`name${item.status === 'cancelled' ? ' cancelled' : ''}`}>
                                    {item.quantity}x {item.nameSnapshot}
                                </span>
                                <span>{centsToEuros(item.price * item.quantity)}</span>
                                {order.status === 'sent' && item.status === 'active' && (
                                    <button
                                        style="background:#fdecea; color:var(--danger); width:36px; height:36px; font-size:18px; border-radius:10px"
                                        title="Anular item"
                                        onClick={() => setCancelTarget({order, item})}
                                    >✕</button>
                                )}
                            </div>
                        ))}
                        {order.note && <p class="muted" style="margin:6px 0 0">Obs: {order.note}</p>}
                    </div>
                ))
            )}

            {!isClosed && !hasUnpaid && (
                <button class="btn secondary" onClick={closeEmpty} disabled={closing}>
                    Fechar mesa (sem consumo)
                </button>
            )}
            <p class="muted" style="margin-top:14px">
                O pagamento e o fecho da conta fazem-se na caixa.
            </p>

            {notice && <div class="banner warning" style="border-radius:12px">{notice}</div>}

            {cancelTarget && (
                <CancelItemDialog
                    order={cancelTarget.order}
                    item={cancelTarget.item}
                    currentUser={currentUser}
                    onClose={() => setCancelTarget(null)}
                    onDone={(result) => {
                        setCancelTarget(null);
                        setNotice(result.voidPrinted
                            ? null
                            : `Item anulado, mas o talão de anulação não foi impresso${result.voidPrintError ? ` (${result.voidPrintError})` : ''}.`);
                        load();
                    }}
                />
            )}
        </div>
    );
}
