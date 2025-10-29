import db from '../../index.js';

const Option = db.options;

import {listPrinters, printTicketRequest, printSessionRequest, listUSBDevices, testDirectConnection as testDirectConnectionService} from '../../../services/printing/printService.js';
import {EscposStrategy} from '../../../services/printing/escposStrategy.js';

export const getPrintName = async () => {
    const opt = await Option.findOne({where: {name: 'printer'}});
    if (!opt || !opt.value) throw new Error('Printer not found !!');
    return opt.value;
};

export const getPrinterList = async (req, res) => {
    try {
        const list = await listPrinters();
        const simpleList = [];
        for (const p of list) {
            if (typeof p === 'string') {
                simpleList.push({name: p, systemName: p});
            } else if (p && typeof p === 'object' && p.name) {
                simpleList.push({name: p.name, systemName: p.systemName});
            }
        }
        res.json(simpleList);
    } catch (err) {
        console.error('[getPrinterList] erro:', err);
        res.status(500).send({message: 'Erro ao listar impressoras'});
    }
};

export const printTicket = async (req, res) => {
    try {
        let printerName = req.body.printer;
        const headers = req.body.headers;
        const printMethod = req.body.printMethod || 'shared';
        const directPrintConfig = req.body.directPrintConfig;

        const items = req.body.items || [];
        const totalAmount = req.body.totalAmount ?? '0';
        const printType = req.body.printType || 'totals';
        const openDrawer = req.body.openDrawer || false;
        const isTest = req.body.test || false;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }

        // For shared printing, require printer name
        if (printMethod !== 'direct' && !printerName) {
            return res.status(404).send('Printer not defined');
        }

        await printTicketRequest({
            printerName,
            headers,
            items,
            totalAmount,
            printType,
            openDrawer,
            isTest,
            printMethod,
            directPrintConfig
        });

        res.send('OK');
    } catch (err) {
        console.error('[printTicketRequest] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

export const printSessionSummary = async (req, res) => {
    try {
        let printerName = req.body.printer;
        const headers = req.body.headers;
        const printMethod = req.body.printMethod || 'shared';
        const directPrintConfig = req.body.directPrintConfig;

        if (!printerName || printerName === 'undefined') {
            try {
                printerName = await getPrintName();
            } catch {
            }
        }

        // For shared printing, require printer name
        if (printMethod !== 'direct' && !printerName) {
            return res.status(404).send('Printer not defined');
        }

        delete req.body.printer;
        delete req.body.headers;
        delete req.body.printMethod;
        delete req.body.directPrintConfig;

        await printSessionRequest({
            printerName,
            headers,
            sessionData: req.body,
            printMethod,
            directPrintConfig
        });
        res.send('OK');
    } catch (err) {
        console.error('[printSessionSummary] erro:', err);
        res.status(500).send({message: 'Erro a imprimir', detail: String(err?.message || err)});
    }
};

export const getUSBDeviceList = async (req, res) => {
    try {
        const devices = await listUSBDevices();
        res.json(devices);
    } catch (err) {
        console.error('[getUSBDeviceList] erro:', err);
        res.status(500).send({message: 'Erro ao listar dispositivos USB'});
    }
};

export const testDirectConnection = async (req, res) => {
    try {
        const config = req.body.config;

        if (!config) {
            return res.status(400).send({message: 'Configuration is required'});
        }

        const result = await testDirectConnectionService(config);
        res.json(result);
    } catch (err) {
        console.error('[testDirectConnection] erro:', err);
        res.status(500).send({message: 'Erro ao testar conexão', detail: String(err?.message || err)});
    }
};

export const getPrinterDetails = async (req, res) => {
    const printerName = req.query.name || req.body.name;

    if (!printerName) {
        return res.status(400).send({message: 'Printer name is required'});
    }

    console.log(`[getPrinterDetails] Getting details for printer: ${printerName}`);

    try {
        // Use existing EscposStrategy (already working!)
        const escpos = new EscposStrategy();
        const printerInfo = await escpos.getPrinterDetails(printerName);

        if (!printerInfo) {
            console.log('[getPrinterDetails] Printer not found');
            return res.status(404).send({
                message: 'Impressora não encontrada',
                detail: `Não foi possível encontrar a impressora "${printerName}"`
            });
        }

        console.log('[getPrinterDetails] Found printer:', JSON.stringify(printerInfo, null, 2));

        const result = {
            printer: {
                Name: printerInfo.name,
                PortName: printerInfo.portName || 'Unknown',
                DriverName: printerInfo.driverName || 'Unknown',
                URI: printerInfo.uri,
                Description: printerInfo.description,
                Location: printerInfo.location,
                IsDefault: printerInfo.isDefault,
                IsShared: printerInfo.isShared,
                State: printerInfo.state,
                StateReasons: printerInfo.stateReasons
            },
            recommendations: []
        };

        // Analyze connection type
        const portName = (printerInfo.portName || '').toUpperCase();
        const uri = (printerInfo.uri || '').toUpperCase();

        console.log(`[getPrinterDetails] Analyzing - PortName: "${portName}", URI: "${uri}"`);

        if (portName.includes('USB') || uri.includes('USB')) {
            result.recommendations.push({
                type: 'usb',
                message: '🔌 Impressora USB detectada',
                suggestion: 'Para usar Impressão Direta USB: 1) Execute o script de instalação (install_script.ps1) para instalar as ferramentas necessárias (Python e Visual Studio Build Tools), 2) Vá a Configurações → Impressora → Conexão Direta → Tipo: USB, 3) Clique em "Listar" para descobrir o VID:PID da impressora (ex: 0x0425:0x0101), 4) Cole o VID:PID no campo "Caminho do Dispositivo". ALTERNATIVA MAIS SIMPLES: Se a impressora tiver Ethernet/WiFi, use Impressão Direta Network (muito mais rápido e sem dependências!).'
            });
        } else if (portName.startsWith('IP_') || portName.includes('TCP') || uri.includes('SOCKET') || uri.includes('IPP')) {
            result.recommendations.push({
                type: 'network',
                message: '✅ Impressora de rede detectada!',
                suggestion: 'Perfeito! Use "Conexão Direta" tipo Network. Configure o IP da impressora e porta 9100 para máximo desempenho.'
            });
        } else if (portName.startsWith('COM')) {
            result.recommendations.push({
                type: 'serial',
                message: `📟 Impressora serial/COM na porta ${printerInfo.portName}`,
                suggestion: `Use "Conexão Direta" tipo Serial. Caminho: ${printerInfo.portName}`
            });
        } else if (portName.startsWith('WSD') || uri.includes('WSD')) {
            result.recommendations.push({
                type: 'network',
                message: '🌐 Impressora de rede (WSD) detectada',
                suggestion: 'Esta impressora está na rede! Verifique o painel da impressora ou configurações para encontrar o IP e use "Conexão Direta" Network.'
            });
        } else {
            result.recommendations.push({
                type: 'unknown',
                message: `❓ Conexão: ${printerInfo.portName || printerInfo.uri || 'Tipo desconhecido'}`,
                suggestion: 'Verifique o manual da impressora. Se tiver porta Ethernet/WiFi, configure IP estático e use Impressão Direta Network (melhor desempenho). Senão, método partilhado funciona bem.'
            });
        }

        res.json(result);

    } catch (err) {
        console.error('[getPrinterDetails] Error:', err);
        res.status(500).send({
            message: 'Erro ao obter detalhes da impressora',
            detail: err.message
        });
    }
};
