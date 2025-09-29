import React from 'react';
import Button from '@mui/material/Button';
import InvoiceService from '../../services/invoice.service';
import {PaymentMethods} from '../../enums/PaymentMethodsEnum';
import CloseSessionModal from '../../components/Admin/CloseSessionModal';
import PrinterService from "../../services/printer.service";
import SessionService from "../../services/session.service";
import {useToast} from "../../components/Common/ToastProvider";
import UserService from "../../services/user.service";

export default function SessionPage({session, setSession, onCloseSession}) {
    const {pushNetworkError} = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [openModal, setOpenModal] = React.useState(false);
    const [invoices, setInvoices] = React.useState([]);

    const eur = React.useMemo(
        () => (cents) =>
            (cents / 100).toLocaleString('pt-PT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }) + ' €',
        []
    );

    const fetchInvoices = React.useCallback(async () => {
        if (!session?.id) return;
        setIsLoading(true);
        try {
            const data = await InvoiceService.GetFromSession(session.id);
            setInvoices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching session movements:', err);
            setInvoices([]);
        } finally {
            setIsLoading(false);
        }
    }, [session?.id]);

    const handleCloseSession = async (notes) => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            pushNetworkError(null, {
                title: 'Utilizador não autenticado',
                message: 'Por favor, inicie sessão novamente.',
            });
            return;
        }


        const userOpen = await UserService.get(session.userOpenId)
            .then(data => {
                return data.data;
            }).catch((error) => {
                console.error('Erro ao obter o utilizador que abriu a sessão:', error);
                pushNetworkError(error, {
                    title: 'Não foi possível obter o utilizador que abriu a sessão',
                });
            });

        const sessionPayload = {
            userOpen: userOpen?.name || 'Desconhecido',
            userClose: user.name || 'Desconhecido',
            openedAt: session.openedAt,
            closedAt: new Date().toISOString(),
            initialAmount: session.initialAmount,
            totalSales: invoices.length,
            payments: paymentsAgg,
            products: productsAgg,
            discountedProducts: discountedProductsAgg.sort((a, b) => b.discount - a.discount),
            closingAmount: totalAmountCents,
            notes: notes,
        };

        await PrinterService.printSessionSummary(sessionPayload).catch((error) => {
            console.error('Erro ao imprimir o resumo da sessão:', error);
            pushNetworkError(error, {
                title: 'Não foi possível imprimir o resumo da sessão',
            });
        });

        const payload = {
            userId: user.id,
            closingAmount: totalAmountCents,
            notes: notes,
        };
        SessionService.close(session.id, payload).then(() => {
            setSession(null);
            setOpenModal(false);
            onCloseSession(true);
        }).catch((error) => {
            pushNetworkError(error, {
                title: 'Não foi possivel fechar a sessão',
            });
            console.error(error.response.data);
        });
    };

    React.useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const {
        totalAmountCents,
        paymentsAgg,
        productsAgg,
        discountedProductsAgg,
        finalCashValueCents,
    } = React.useMemo(() => {
        let totalAmount = 0;
        const paymentsMap = new Map();
        const productsMap = new Map();
        const discountedMap = new Map();
        let cashTotal = session?.initialAmount ?? 0;

        for (const inv of invoices ?? []) {
            const invTotal = inv?.total ?? 0;
            const method = inv?.paymentMethod ?? 'cash';

            totalAmount += invTotal;

            paymentsMap.set(method, (paymentsMap.get(method) ?? 0) + invTotal);

            if (method === 'cash') cashTotal += invTotal;

            for (const rec of inv?.records ?? []) {
                const p = rec?.productItem;
                if (!p) continue;

                const qty = rec?.quantity ?? 0;
                const price = p?.price ?? 0;

                const hasDiscount = inv?.discountPercent && inv.discountPercent > 0;
                if (hasDiscount) {
                    const discPct = inv.discountPercent;
                    const discountedPrice = Math.round(price * (1 - discPct / 100));
                    const key = `${p.id}-${discPct}`;
                    const prev = discountedMap.get(key) ?? {
                        id: p.id,
                        name: p.name,
                        quantity: 0,
                        total: 0,
                        discount: discPct,
                    };
                    prev.quantity += qty;
                    prev.total += discountedPrice * qty;
                    discountedMap.set(key, prev);
                } else {
                    const prev = productsMap.get(p.id) ?? {
                        id: p.id,
                        name: p.name,
                        quantity: 0,
                        total: 0,
                    };
                    prev.quantity += qty;
                    prev.total += price * qty;
                    productsMap.set(p.id, prev);
                }
            }
        }

        return {
            totalAmountCents: totalAmount,
            paymentsAgg: Array.from(paymentsMap, ([method, amount]) => ({method, amount})),
            productsAgg: Array.from(productsMap.values()),
            discountedProductsAgg: Array.from(discountedMap.values()),
            finalCashValueCents: cashTotal,
        };
    }, [invoices, session?.initialAmount]);

    const sessionDate = React.useMemo(() => {
        const d = new Date(session?.openedAt);
        return new Intl.DateTimeFormat('pt-PT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    }, [session?.openedAt]);

    return (
        <div>
            {isLoading ? (
                'A carregar dados...'
            ) : (
                <div>
                    <h2 className="mb-2">Movimentos da sessão</h2>
                    <h5 className="mb-4">Início: {sessionDate}</h5>

                    {invoices.length === 0 && <p>Nenhuma movimentação registada.</p>}

                    {invoices.length > 0 && (
                        <>
                            <h2 className="mb-3">Produtos Vendidos</h2>
                            <hr className="my-1"/>
                            <table className="table">
                                <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Quantidade</th>
                                    <th>Total</th>
                                </tr>
                                </thead>
                                <tbody>
                                {productsAgg.map((p) => (
                                    <tr key={`p-${p.id}`}>
                                        <td>{p.name}</td>
                                        <td>{p.quantity}</td>
                                        <td>{eur(p.total)}</td>
                                    </tr>
                                ))}
                                {discountedProductsAgg.map((p) => (
                                    <tr key={`pd-${p.id}-${p.discount}`}>
                                        <td>
                                            {p.name}{' '}
                                            <span
                                                className="mx-1 badge bg-warning text-dark">Desconto ({p.discount}%)</span>
                                        </td>
                                        <td>{p.quantity}</td>
                                        <td>{eur(p.total)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            <h2 className="mb-3 mt-5">Pagamentos</h2>
                            <hr className="my-1"/>
                            <table className="table">
                                <thead>
                                <tr>
                                    <th>Método de Pagamento</th>
                                    <th>Valor</th>
                                </tr>
                                </thead>
                                <tbody>
                                {paymentsAgg.map((p) => {
                                    const label = PaymentMethods.find((pm) => pm.id === p.method)?.name ?? p.method;
                                    return (
                                        <tr key={`pay-${p.method}`}>
                                            <td>{label}</td>
                                            <td>{eur(p.amount)}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>

                            <h2 className="mb-3 mt-5">Faturação</h2>
                            <hr className="my-1"/>
                            <h3 className="mt-4">Total Faturado: {eur(totalAmountCents)}</h3>
                            {session?.initialAmount > 0 && (
                                <h4>
                                    Valor de abertura de caixa: {eur(session.initialAmount)}
                                </h4>
                            )}
                            <h3 className="mt-2">Total em Caixa (Dinheiro): {eur(finalCashValueCents)}</h3>
                        </>
                    )}

                    <hr className="my-4"/>
                    <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={() => setOpenModal(true)}
                    >
                        Fechar Turno
                    </Button>
                </div>
            )}

            <CloseSessionModal
                open={openModal}
                setModal={setOpenModal}
                onCloseSession={handleCloseSession}
                session={session}
                setSession={setSession}
                closingAmount={totalAmountCents}
            />
        </div>
    );
}