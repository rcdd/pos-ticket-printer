import {useState} from 'preact/hooks';
import {api} from '../api.js';
import {centsToEuros} from '../money.js';

const formatNumber = (number) => `#${String(number ?? 0).padStart(3, '0')}`;

export function OrderSent({result, table, onNewOrder, onViewTable, onHome}) {
    const order = result.order;
    const [printed, setPrinted] = useState(result.printed);
    const [printError, setPrintError] = useState(result.printError);
    const [reprinting, setReprinting] = useState(false);

    const reprint = async () => {
        if (reprinting) return;
        setReprinting(true);
        try {
            const res = await api(`/order/${order.id}/reprint`, {method: 'POST'});
            setPrinted(res.printed);
            setPrintError(res.printError);
        } catch (err) {
            setPrintError(err.message);
        } finally {
            setReprinting(false);
        }
    };

    return (
        <div class="screen">
            <div class="center">
                <div class="card" style="text-align:center">
                    <p class="muted" style="margin:0">
                        {result.duplicate ? 'Pedido já registado' : 'Pedido registado'}
                    </p>
                    <div class="big-number">{formatNumber(order.number)}</div>
                    <p style="margin:4px 0; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap">
                        {table ? (
                            <>
                                <span style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Mesa</span>
                                <span class="table-badge">{table.displayName || table.number}</span>
                            </>
                        ) : <span>Pedido avulso</span>}
                        <span>· {centsToEuros(order.total)}</span>
                    </p>
                    {printed ? (
                        <p style={`color:var(--success); font-weight:600`}>🖨️ Talão impresso</p>
                    ) : (
                        <>
                            <p class="error-text">⚠️ O talão não foi impresso{printError ? `: ${printError}` : '.'}</p>
                            <button class="btn secondary" onClick={reprint} disabled={reprinting}>
                                {reprinting ? 'A imprimir…' : 'Tentar imprimir de novo'}
                            </button>
                        </>
                    )}
                </div>

                <button class="btn" onClick={onNewOrder}>
                    {table ? `Novo pedido — Mesa ${table.displayName || table.number}` : 'Novo pedido avulso'}
                </button>
                {onViewTable && (
                    <button class="btn secondary" onClick={onViewTable}>Ver mesa</button>
                )}
                <button class="btn ghost" onClick={onHome}>Início</button>
            </div>
        </div>
    );
}
