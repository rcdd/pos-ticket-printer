import db from '../../index.js';

const Option = db.options;

import {listPrinters, printTicketRequest, printSessionRequest, listUSBDevices, testDirectConnection as testDirectConnectionService} from '../../../services/printing/printService.js';

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
    try {
        const printerName = req.query.name || req.body.name;

        if (!printerName) {
            return res.status(400).send({message: 'Printer name is required'});
        }

        console.log(`[getPrinterDetails] Getting details for printer: ${printerName}`);

        // Use PowerShell to get detailed printer information
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Escape printer name for PowerShell - replace " with ""
        const escapedPrinterName = printerName.replace(/"/g, '""');

        // Use PowerShell with proper escaping
        const psCommand = `Get-Printer -Name '${escapedPrinterName}' | Select-Object Name, DriverName, PortName, Shared, Published, ComputerName | ConvertTo-Json`;

        console.log(`[getPrinterDetails] Executing: ${psCommand}`);

        const { stdout, stderr } = await execAsync(`powershell.exe -ExecutionPolicy Bypass -Command "${psCommand}"`, {
            timeout: 5000,
            windowsHide: true
        });

        if (stderr) {
            console.log(`[getPrinterDetails] PowerShell stderr: ${stderr}`);
        }

        console.log(`[getPrinterDetails] PowerShell stdout: ${stdout}`);

        const printerInfo = JSON.parse(stdout);

        // Get port details
        const escapedPortName = (printerInfo.PortName || '').replace(/"/g, '""');
        const portCommand = `Get-PrinterPort -Name '${escapedPortName}' | Select-Object Name, Description, PortMonitor, PortNumber | ConvertTo-Json`;

        let portInfo = null;
        try {
            console.log(`[getPrinterDetails] Getting port info for: ${printerInfo.PortName}`);
            const { stdout: portStdout, stderr: portStderr } = await execAsync(`powershell.exe -ExecutionPolicy Bypass -Command "${portCommand}"`, {
                timeout: 5000,
                windowsHide: true
            });

            if (portStderr) {
                console.log('[getPrinterDetails] Port query stderr:', portStderr);
            }

            if (portStdout && portStdout.trim()) {
                portInfo = JSON.parse(portStdout);
                console.log('[getPrinterDetails] Port info:', portInfo);
            }
        } catch (err) {
            console.log('[getPrinterDetails] Could not get port info:', err.message);
        }

        const result = {
            printer: printerInfo,
            port: portInfo,
            recommendations: []
        };

        // Analyze and provide recommendations
        if (printerInfo.PortName) {
            const portName = printerInfo.PortName.toUpperCase();

            if (portName.startsWith('USB')) {
                result.recommendations.push({
                    type: 'usb',
                    message: 'This printer is connected via USB. Direct USB printing on Windows is complex.',
                    suggestion: 'Consider using Network printing or Shared printer method (fallback).'
                });
            } else if (portName.startsWith('IP_') || portName.includes('TCP')) {
                result.recommendations.push({
                    type: 'network',
                    message: 'This printer appears to be network-connected.',
                    suggestion: `Use Direct Network printing with the IP address from port ${printerInfo.PortName}.`
                });

                if (portInfo && portInfo.PortNumber) {
                    result.recommendations.push({
                        type: 'network',
                        message: `Network port detected: ${portInfo.PortNumber}`,
                        suggestion: `Try Direct Network printing with port ${portInfo.PortNumber}.`
                    });
                }
            } else if (portName.startsWith('COM')) {
                result.recommendations.push({
                    type: 'serial',
                    message: `This printer is connected via serial port ${printerInfo.PortName}.`,
                    suggestion: `Use Direct Serial printing with device path: ${printerInfo.PortName}`
                });
            } else if (portName.startsWith('FILE:')) {
                result.recommendations.push({
                    type: 'other',
                    message: 'This is a print-to-file printer.',
                    suggestion: 'Not suitable for POS printing.'
                });
            } else if (portName.startsWith('WSD')) {
                result.recommendations.push({
                    type: 'network',
                    message: 'This is a network printer using WSD (Web Services for Devices).',
                    suggestion: 'Check your printer settings for its IP address and use Direct Network printing.'
                });
            }
        }

        res.json(result);
    } catch (err) {
        console.error('[getPrinterDetails] PowerShell method failed:', err);

        // Fallback: Try using @printers/printers library
        try {
            console.log('[getPrinterDetails] Trying fallback method with @printers/printers...');
            const { default: printersLib } = await import('@printers/printers');
            const allPrinters = await printersLib.getAllPrinters();

            const foundPrinter = allPrinters.find(p =>
                p.name === printerName || p.systemName === printerName
            );

            if (!foundPrinter) {
                return res.status(404).send({
                    message: 'Impressora não encontrada',
                    detail: `Não foi possível encontrar a impressora "${printerName}"`
                });
            }

            console.log('[getPrinterDetails] Found printer via library:', foundPrinter);

            const result = {
                printer: {
                    Name: foundPrinter.name,
                    PortName: foundPrinter.portName || 'Unknown',
                    DriverName: foundPrinter.driver || 'Unknown',
                    connection: foundPrinter.connection,
                    status: foundPrinter.status
                },
                port: null,
                recommendations: [],
                method: 'library'
            };

            // Analyze connection type
            const portName = (foundPrinter.portName || '').toUpperCase();
            const connection = (foundPrinter.connection || '').toUpperCase();

            if (portName.includes('USB') || connection.includes('USB')) {
                result.recommendations.push({
                    type: 'usb',
                    message: 'Impressora USB detectada.',
                    suggestion: 'Para melhor desempenho, considere: 1) Adicionar conexão de rede à impressora, ou 2) Manter método partilhado (mais lento mas funcional).'
                });
            } else if (portName.startsWith('IP_') || portName.includes('TCP') || connection.includes('NETWORK')) {
                result.recommendations.push({
                    type: 'network',
                    message: 'Impressora de rede detectada!',
                    suggestion: 'Use "Impressão Direta" com o IP da impressora para máximo desempenho.'
                });
            } else if (portName.startsWith('COM')) {
                result.recommendations.push({
                    type: 'serial',
                    message: `Impressora serial detectada na porta ${foundPrinter.portName}.`,
                    suggestion: `Use "Impressão Direta" tipo Serial com: ${foundPrinter.portName}`
                });
            } else {
                result.recommendations.push({
                    type: 'unknown',
                    message: `Tipo de conexão: ${foundPrinter.portName || 'Desconhecido'}`,
                    suggestion: 'Se a impressora tiver capacidade de rede (Ethernet/WiFi), configure-a para usar Impressão Direta Network (mais rápido).'
                });
            }

            res.json(result);

        } catch (fallbackErr) {
            console.error('[getPrinterDetails] Fallback also failed:', fallbackErr);
            res.status(500).send({
                message: 'Erro ao obter detalhes da impressora',
                detail: `PowerShell: ${err.message}. Library: ${fallbackErr.message}`
            });
        }
    }
};
