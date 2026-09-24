import {useCallback, useEffect, useState} from 'preact/hooks';
import {api} from '../api.js';
import {centsToEuros} from '../money.js';

export function Home({liveTick, canOrder, onNewStandalone, onOpenTable, onNewTable}) {
    const [tables, setTables] = useState(null);
    const [error, setError] = useState(null);

    // "new table/group" flow: just asks for the table number and creates it —
    // the server assigns the letter (12 -> 12A, next group at 12 -> 12B, ...).
    // Existing groups are browsed/opened via the "Contas abertas" grid below,
    // not here, so a table number never appears in two different lists at once.
    const [creatingOpen, setCreatingOpen] = useState(false);
    const [newNumber, setNewNumber] = useState('');
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            setTables(await api('/tables'));
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000); // fallback; SSE handles realtime
        return () => clearInterval(interval);
    }, [load, liveTick]);

    const createGroup = async (number) => {
        if (creating) return;
        setCreating(true);
        setError(null);
        try {
            const tab = await api('/table', {method: 'POST', body: {number}});
            setNewNumber('');
            setCreatingOpen(false);
            onNewTable(tab);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const submitCreate = (event) => {
        event.preventDefault();
        createGroup(newNumber);
    };

    return (
        <div class="screen">
            <button class="btn" style="margin-bottom:14px" disabled={!canOrder} onClick={onNewStandalone}>
                🧾 Pedido avulso
            </button>

            {!creatingOpen ? (
                <button
                    class="btn"
                    style="margin-bottom:14px"
                    disabled={!canOrder}
                    onClick={() => setCreatingOpen(true)}
                >
                    ➕ Nova mesa / grupo
                </button>
            ) : (
                <form class="card" style="margin-bottom:14px" onSubmit={submitCreate}>
                    <h3>Nova mesa / grupo</h3>
                    <div style="display:flex; gap:8px">
                        <input
                            style="flex:1; min-width:0"
                            placeholder="Nº da mesa"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            autoFocus
                            value={newNumber}
                            onInput={(e) => setNewNumber(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                        />
                        <button class="btn" type="submit"
                                style="width:auto; padding:12px 18px; white-space:nowrap; flex:0 0 auto"
                                disabled={!newNumber.trim() || creating}>
                            {creating ? 'A criar…' : 'Criar'}
                        </button>
                        <button
                            type="button"
                            class="back-btn"
                            aria-label="Cancelar"
                            onClick={() => {
                                setCreatingOpen(false);
                                setNewNumber('');
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </form>
            )}

            <h3>Contas abertas</h3>
            {error && <p class="error-text">{error}</p>}
            {tables === null ? (
                <div class="spinner"/>
            ) : tables.length === 0 ? (
                <p class="muted">Não há contas abertas.</p>
            ) : (
                <div class="grid">
                    {tables.map((table) => (
                        <button key={table.id} class="tile table-tile" onClick={() => onOpenTable(table)}>
                            <span class="label">{table.displayName}</span>
                            <span class="amount">
                                {table.openOrders > 0 ? centsToEuros(table.unpaidTotal) : '—'}
                            </span>
                            {table.openedBy && (
                                <span class="muted" style="font-size:11px; line-height:1">
                                    {table.openedBy.name || table.openedBy.username}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
