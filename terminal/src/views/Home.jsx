import {useCallback, useEffect, useState} from 'preact/hooks';
import {api} from '../api.js';
import {centsToEuros} from '../money.js';

const nextFreeLetter = (tabs) => {
    const used = new Set((tabs ?? []).map((tab) => tab.letter).filter(Boolean));
    for (let i = 0; i < 26; i += 1) {
        const letter = String.fromCharCode(65 + i);
        if (!used.has(letter)) return letter;
    }
    return null;
};

export function Home({liveTick, canOrder, onNewStandalone, onOpenTable, onNewTable}) {
    const [tables, setTables] = useState(null);
    const [error, setError] = useState(null);

    // fluxo "mesa → grupos": escrever o nº mostra as contas dessa mesa
    const [tableQuery, setTableQuery] = useState('');
    const [groups, setGroups] = useState(null); // {number, tabs} | null
    const [loadingGroups, setLoadingGroups] = useState(false);
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
        const interval = setInterval(load, 60000); // fallback; o SSE trata do tempo real
        return () => clearInterval(interval);
    }, [load, liveTick]);

    const lookupTable = useCallback(async (numberRaw) => {
        const number = String(numberRaw ?? '').trim();
        if (!number) return;
        setLoadingGroups(true);
        setError(null);
        try {
            setGroups(await api(`/tables/by-number/${encodeURIComponent(number)}`));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    // com o painel de grupos aberto, mantém-no fresco (SSE)
    useEffect(() => {
        if (groups?.number) {
            lookupTable(groups.number);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTick]);

    const createGroup = async (number) => {
        if (creating) return;
        setCreating(true);
        setError(null);
        try {
            const tab = await api('/table', {method: 'POST', body: {number}});
            setTableQuery('');
            setGroups(null);
            onNewTable(tab);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const submitLookup = (event) => {
        event.preventDefault();
        lookupTable(tableQuery);
    };

    const hintLetter = groups ? nextFreeLetter(groups.tabs) : null;

    return (
        <div class="screen">
            <button class="btn" style="margin-bottom:14px" disabled={!canOrder} onClick={onNewStandalone}>
                🧾 Pedido avulso
            </button>

            <form class="card" style="margin-bottom:14px" onSubmit={submitLookup}>
                <h3>Mesa</h3>
                <div style="display:flex; gap:8px">
                    <input
                        placeholder="Nº da mesa"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={tableQuery}
                        onInput={(e) => setTableQuery(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                    />
                    <button class="btn" type="submit" style="width:auto; padding:12px 18px"
                            disabled={!tableQuery.trim() || loadingGroups}>
                        {loadingGroups ? '…' : 'Ver'}
                    </button>
                </div>

                {groups && (
                    <div style="margin-top:12px">
                        <div style="display:flex; align-items:baseline; justify-content:space-between">
                            <strong>Mesa {groups.number}</strong>
                            <button type="button" class="btn ghost" style="width:auto; padding:4px 10px; font-size:14px"
                                    onClick={() => {
                                        setGroups(null);
                                        setTableQuery('');
                                    }}>
                                fechar ✕
                            </button>
                        </div>

                        {groups.tabs.length === 0 ? (
                            <p class="muted" style="margin:6px 0">Sem grupos abertos nesta mesa.</p>
                        ) : (
                            groups.tabs.map((tab) => (
                                <button
                                    type="button"
                                    key={tab.id}
                                    class="group-row"
                                    onClick={() => onOpenTable(tab)}
                                >
                                    <span style="display:flex; flex-direction:column; align-items:flex-start; min-width:0">
                                        <span class="group-name">{tab.displayName}</span>
                                        {tab.openedBy && (
                                            <span class="muted" style="font-size:12px">
                                                {tab.openedBy.name || tab.openedBy.username}
                                            </span>
                                        )}
                                    </span>
                                    <span class="muted">
                                        {tab.openOrders > 0
                                            ? `${tab.openOrders} pedido(s) · ${centsToEuros(tab.unpaidTotal)}`
                                            : 'sem consumo'}
                                    </span>
                                </button>
                            ))
                        )}

                        <button
                            type="button"
                            class="btn"
                            style="margin-top:8px"
                            disabled={!canOrder || creating || !hintLetter}
                            onClick={() => createGroup(groups.number)}
                        >
                            {creating ? 'A abrir…'
                                : hintLetter ? `➕ Novo grupo (fica ${groups.number}${hintLetter})`
                                    : 'Mesa cheia (26 grupos)'}
                        </button>
                    </div>
                )}
            </form>

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
