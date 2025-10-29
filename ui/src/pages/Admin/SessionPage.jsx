import React, { useMemo, useCallback, useEffect, useState } from "react";
import {
    Box, Button, Chip, Card, CardContent, Grid, Typography, Divider, Stack, Skeleton, Table,
    TableHead, TableRow, TableCell, TableBody, Tooltip
} from "@mui/material";
import InvoiceService from "../../services/invoice.service";
import { PaymentMethods } from "../../enums/PaymentMethodsEnum";
import CloseSessionModal from "../../components/Admin/CloseSessionModal";
import PrinterService from "../../services/printer.service";
import SessionService from "../../services/session.service";
import AuthService from "../../services/auth.service";
import { useToast } from "../../components/Common/ToastProvider";
import UserService from "../../services/user.service";
import CashMovementService from "../../services/cashMovement.service";
import CashMovementModal from "../../components/Admin/CashMovementModal";
import {computeSessionAggregates} from "../../utils/sessionAggregates";
import {useSession} from "../../context/SessionContext.jsx";

export default function SessionPage({ onCloseSession }) {
    const {session, setSession, refreshSession} = useSession();
    const { pushNetworkError } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [openModalEndSession, setOpenModalEndSession] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [users, setUsers] = useState([]);
    const [cashMovements, setCashMovements] = useState([]);
    const [modalMovementsOpen, setModalMovementsOpen] = useState(false);
    const [modalType, setModalType] = useState("CASH_IN");

    const eurCents = useCallback((cents) => {
        const n = Number(cents || 0) / 100;
        return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    }, []);

    const getUserName = useCallback((userId) => {
        return users.find((u) => u.id === userId)?.name || "Desconhecido";
    }, [users]);

    const fetchInvoices = useCallback(async () => {
        if (!session?.id) return [];
        try {
            const data = await InvoiceService.getFromSession(session.id);
            const list = Array.isArray(data) ? data : [];
            setInvoices(list);
            return list;
        } catch (err) {
            console.error("Error fetching session invoices:", err);
            setInvoices([]);
            return [];
        }
    }, [session?.id]);

    const fetchUsers = useCallback(async () => {
        try {
            const data = await UserService.getAll();
            const list = Array.isArray(data) ? data : [];
            setUsers(list);
            return list;
        } catch (err) {
            console.error("Error fetching users:", err);
            setUsers([]);
            return [];
        }
    }, []);

    const fetchCashMovements = useCallback(async () => {
        if (!session?.id) return [];
        try {
            const data = await CashMovementService.getFromSession(session.id);
            const list = Array.isArray(data) ? data : [];
            setCashMovements(list);
            return list;
        } catch (err) {
            console.error("Error fetching session cash movements:", err);
            setCashMovements([]);
            return [];
        }
    }, [session?.id]);

    useEffect(() => {
        let mounted = true;

        if (!session?.id) {
            setIsLoading(false);
            setInvoices([]);
            setCashMovements([]);
            return () => { mounted = false; };
        }

        (async () => {
            setIsLoading(true);
            await Promise.all([fetchInvoices(), fetchCashMovements(), fetchUsers()]);
            if (mounted) setIsLoading(false);
        })();
        return () => { mounted = false; };
    }, [session?.id, fetchInvoices, fetchCashMovements, fetchUsers]);

    const handleCloseSession = async (notes) => {
        if (!session?.id) {
            pushNetworkError(null, { title: "Sessão não encontrada", message: "Não existe sessão ativa para fechar." });
            return;
        }

        const user = AuthService.getUser();
        if (!user) {
            pushNetworkError(null, { title: "Utilizador não autenticado", message: "Por favor, inicie sessão novamente." });
            return;
        }

        let userOpen = null;
        try {
            const res = await UserService.get(session.userOpenId);
            userOpen = res?.data ?? null;
        } catch (error) {
            console.error("Erro ao obter o utilizador que abriu a sessão:", error);
            pushNetworkError(error, { title: "Não foi possível obter o utilizador que abriu a sessão" });
        }

        const {
            totalAmountCents,
            paymentsAgg,
            productsAgg,
            discountedProductsAgg,
            finalCashValueCents
        } = computeSessionAggregates(invoices, session?.initialAmount ?? 0, cashMovements);

        const sessionPayload = {
            sessionId : session.id,
            userOpen: userOpen?.name || "Desconhecido",
            userClose: user.name || "Desconhecido",
            openedAt: session.openedAt,
            closedAt: new Date().toISOString(),
            initialAmount: session.initialAmount,
            totalSales: invoices.length,
            payments: paymentsAgg,
            products: productsAgg,
            discountedProducts: discountedProductsAgg.sort((a, b) => b.discount - a.discount),
            closingAmount: totalAmountCents,
            finalCashValue: finalCashValueCents,
            notes,
            cashMovements,
            openDrawer: true
        };

        await PrinterService.printSessionSummary(sessionPayload).catch((error) => {
            console.error("Erro ao imprimir o resumo da sessão:", error);
            pushNetworkError(error, { title: "Não foi possível imprimir o resumo da sessão" });
        });

        const payload = {
            userId: user.id,
            closingAmount: finalCashValueCents,
            notes,
        };

        SessionService.close(session.id, payload).then(() => {
            setSession(null);
            setOpenModalEndSession(false);
            if (typeof refreshSession === 'function') {
                refreshSession();
            }
            onCloseSession(true);
        }).catch((error) => {
            pushNetworkError(error, { title: "Não foi possível fechar a sessão" });
            console.error(error?.response?.data || error);
        });
    };

    const {
        totalAmountCents,
        paymentsAgg,
        productsAgg,
        discountedProductsAgg,
        finalCashValueCents,
        cashIn,
        cashOut,
        netAdjustments,
    } = useMemo(() => computeSessionAggregates(invoices, session?.initialAmount ?? 0, cashMovements), [invoices, session?.initialAmount, cashMovements]);

    const sessionDate = useMemo(() => {
        const d = new Date(session?.openedAt || new Date());
        return new Intl.DateTimeFormat("pt-PT", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d);
    }, [session?.openedAt]);

    const openModalCashMovement = (type) => {
        setModalType(type);
        setModalMovementsOpen(true);
    };

    const handleMovementSaved = () => {
        fetchCashMovements();
    };

    if (!session) {
        return (
            <Box>
                <Typography variant="h5" sx={{mb: 2}}>Nenhuma sessão ativa</Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
                    Inicie uma sessão no POS para acompanhar vendas e movimentos de caixa.
                </Typography>
                <Button variant="contained" onClick={() => onCloseSession(false)}>Voltar ao POS</Button>
            </Box>
        );
    }

    return (
        <Box>
            {isLoading ? (
                <Skeleton variant="rectangular" height={200} />
            ) : (
                <Box>
                    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                        <Box>
                            <Typography variant="h5" fontWeight={700}>Sessão em curso</Typography>
                            <Typography variant="body2" color="text.secondary">Início: {sessionDate}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Button variant="outlined" onClick={() => openModalCashMovement("CASH_IN")}>
                                Reforço
                            </Button>
                            <Button variant="outlined" color="error" onClick={() => openModalCashMovement("CASH_OUT")}>
                                Sangria
                            </Button>
                            <Button variant="contained" color="error" onClick={() => setOpenModalEndSession(true)}>
                                Fechar Turno
                            </Button>
                        </Stack>
                    </Stack>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <SummaryCard title="Total Faturado" value={eurCents(totalAmountCents)} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <SummaryCard title="Dinheiro em Caixa" value={eurCents(finalCashValueCents)} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <SummaryCard title="Reforços" value={eurCents(cashIn)} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <SummaryCard title="Sangrias" value={eurCents(cashOut)} negative />
                        </Grid>
                    </Grid>

                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Typography variant="h6" fontWeight={700}>Movimentos de Caixa</Typography>
                                <Chip label={`Ajuste líquido: ${eurCents(netAdjustments)}`} color={netAdjustments >= 0 ? "success" : "error"} variant="outlined" />
                            </Stack>
                            <Divider sx={{ mb: 2 }} />
                            {cashMovements.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">Ainda não há movimentos de caixa.</Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell width={180}>Tipo</TableCell>
                                            <TableCell>Motivo</TableCell>
                                            <TableCell align="right">Valor</TableCell>
                                            <TableCell width={180}>Utilizador</TableCell>
                                            <TableCell width={180}>Data</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {cashMovements.map((m) => {
                                            const dateStr = new Date(m.createdAt).toLocaleString("pt-PT");
                                            const isIn = m.type === "CASH_IN";
                                            return (
                                                <TableRow key={m.id}>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={isIn ? "Reforço" : "Sangria"}
                                                            color={isIn ? "success" : "error"}
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title={m.reason || ""} arrow>
                                                            <span>{m.reason || "—"}</span>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell align="right">{eurCents(Number(m.amount))}</TableCell>
                                                    <TableCell>{getUserName(m.userId)}</TableCell>
                                                    <TableCell>{dateStr}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {invoices.length > 0 && (
                        <>
                            <SectionProducts productsAgg={productsAgg} discountedProductsAgg={discountedProductsAgg} eur={eurCents} />
                            <SectionPayments paymentsAgg={paymentsAgg} />
                            <Card sx={{ mt: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight={700}>Resumo</Typography>
                                    <Divider sx={{ my: 1 }} />
                                    <Stack spacing={0.5}>
                                        <Typography>Total Faturado: <b>{eurCents(totalAmountCents)}</b></Typography>
                                        {session?.initialAmount > 0 && (
                                            <Typography>Valor de abertura de caixa: <b>{eurCents(session.initialAmount)}</b></Typography>
                                        )}
                                        <Typography>Dinheiro em Caixa (inclui reforços/sangrias): <b>{eurCents(finalCashValueCents)}</b></Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </Box>
            )}

            <CloseSessionModal
                open={openModalEndSession}
                setModal={setOpenModalEndSession}
                onCloseSession={handleCloseSession}
            />

            <CashMovementModal
                open={modalMovementsOpen}
                onClose={() => setModalMovementsOpen(false)}
                modalType={modalType}
                session={session}
                onSaved={handleMovementSaved}
            />
        </Box>
    );
}

function SummaryCard({ title, value, negative }) {
    return (
        <Card>
            <CardContent>
                <Typography variant="overline" color="text.secondary">{title}</Typography>
                <Typography variant="h6" fontWeight={700} color={negative ? "error.main" : "text.primary"}>
                    {value}
                </Typography>
            </CardContent>
        </Card>
    );
}

function SectionProducts({ productsAgg, discountedProductsAgg, eur }) {
    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h6" fontWeight={700}>Produtos Vendidos</Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Produto</TableCell>
                            <TableCell>Zona</TableCell>
                            <TableCell align="right">Quantidade</TableCell>
                            <TableCell align="right">Total</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {productsAgg.map((p) => (
                            <TableRow key={`p-${p.id}`}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.zone?.name}</TableCell>
                                <TableCell align="right">{p.quantity}</TableCell>
                                <TableCell align="right">{eur(p.total)}</TableCell>
                            </TableRow>
                        ))}
                        {discountedProductsAgg.map((p) => (
                            <TableRow key={`pd-${p.id}-${p.discount}`}>
                                <TableCell>
                                    {p.name}{" "}
                                    <Chip size="small" label={`Desconto ${p.discount}%`} color="warning" variant="outlined" sx={{ ml: 1 }} />
                                </TableCell>
                                <TableCell>—</TableCell>
                                <TableCell align="right">{p.quantity}</TableCell>
                                <TableCell align="right">{eur(p.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function SectionPayments({ paymentsAgg }) {
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" fontWeight={700}>Pagamentos</Typography>
                <Divider sx={{ mb: 2 }} />
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Método</TableCell>
                            <TableCell align="right">Valor</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paymentsAgg.map((p) => {
                            const label = PaymentMethods.find((pm) => pm.id === p.method)?.name ?? p.method;
                            return (
                                <TableRow key={`pay-${p.method}`}>
                                    <TableCell>{label}</TableCell>
                                    <TableCell align="right">
                                        {(p.amount / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
