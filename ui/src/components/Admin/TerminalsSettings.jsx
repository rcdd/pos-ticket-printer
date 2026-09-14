import React, {useCallback, useEffect, useState} from 'react';
import {
    Alert, Box, Chip, CircularProgress, Paper, Stack, Switch, Typography,
} from '@mui/material';
import QRCode from 'qrcode';
import OrderService from '../../services/order.service';
import {useToast} from '../Common/ToastProvider';

// Multi-terminal mode settings + access QR codes for the terminals.
// Effective = license includes multi AND the option is enabled.
export default function TerminalsSettings() {
    const {pushNetworkError, pushMessage} = useToast();
    const [info, setInfo] = useState(null);
    const [saving, setSaving] = useState(false);
    const [qrCodes, setQrCodes] = useState({});

    const load = useCallback(async () => {
        try {
            const {data} = await OrderService.getSystemInfo();
            setInfo(data);
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível obter o estado dos terminais'});
        }
    }, [pushNetworkError]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!info?.multiTerminal?.effective || !info?.addresses?.length) {
            setQrCodes({});
            return;
        }
        let canceled = false;
        (async () => {
            const codes = {};
            for (const address of info.addresses) {
                try {
                    codes[address.ip] = await QRCode.toDataURL(address.terminalUrl, {width: 220, margin: 1});
                } catch {
                }
            }
            if (!canceled) setQrCodes(codes);
        })();
        return () => {
            canceled = true;
        };
    }, [info]);

    const handleToggle = async (event) => {
        const next = event.target.checked;
        setSaving(true);
        try {
            await OrderService.setMultiTerminalOption(next);
            pushMessage('success', next ? 'Modo multiposto ativado.' : 'Modo multiposto desativado.');
            await load();
        } catch (error) {
            pushNetworkError(error, {title: 'Não foi possível alterar o modo multiposto'});
        } finally {
            setSaving(false);
        }
    };

    if (!info) {
        return (
            <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={20}/>
                <Typography variant="body2">A carregar…</Typography>
            </Stack>
        );
    }

    const {licensed, enabled, effective} = info.multiTerminal;

    return (
        <Stack spacing={3}>
            <Paper elevation={0} sx={{p: 3, border: (theme) => `1px solid ${theme.palette.divider}`}}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                    Modo multiposto
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Permite que empregados registem pedidos a partir de telemóveis/tablets ligados à rede
                    local. Os pedidos são impressos na impressora e pagos aqui, na caixa.
                </Typography>

                {!licensed && (
                    <Alert severity="warning" sx={{mb: 2}}>
                        A licença atual não inclui o modo multiposto. Contacte o suporte para atualizar.
                    </Alert>
                )}

                <Stack direction="row" spacing={2} alignItems="center">
                    <Switch
                        checked={enabled && licensed}
                        onChange={handleToggle}
                        disabled={!licensed || saving}
                    />
                    <Typography variant="body2">
                        {effective ? 'Multiposto ativado' : 'Multiposto desativado'}
                    </Typography>
                    {saving && <CircularProgress size={18}/>}
                </Stack>
            </Paper>

            {effective && (
                <Paper elevation={0} sx={{p: 3, border: (theme) => `1px solid ${theme.palette.divider}`}}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                        Acesso dos terminais
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        No telemóvel, leia o QR code (ou abra o endereço) com o Wi-Fi da rede local ligado.
                        Sugestão: no browser, use "Adicionar ao ecrã principal" para ficar como uma app.
                    </Typography>

                    {info.addresses.length === 0 ? (
                        <Alert severity="info">
                            Nenhuma interface de rede ativa encontrada. Ligue o PC à rede local.
                        </Alert>
                    ) : (
                        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                            {info.addresses.map((address) => (
                                <Box key={address.ip} sx={{textAlign: 'center'}}>
                                    {qrCodes[address.ip] && (
                                        <img src={qrCodes[address.ip]} alt={`QR ${address.terminalUrl}`}
                                             width={220} height={220}/>
                                    )}
                                    <Typography variant="body2" fontWeight={600}>
                                        {address.terminalUrl}
                                    </Typography>
                                    <Chip size="small" label={address.interface} sx={{mt: 0.5}}/>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Paper>
            )}
        </Stack>
    );
}
