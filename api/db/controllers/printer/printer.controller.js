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

        const psCommand = `Get-Printer -Name "${printerName}" | Select-Object Name, DriverName, PortName, Shared, Published, ComputerName | ConvertTo-Json`;

        const { stdout } = await execAsync(`powershell.exe -Command "${psCommand}"`, {
            timeout: 5000,
            windowsHide: true
        });

        const printerInfo = JSON.parse(stdout);

        // Get port details
        const portCommand = `Get-PrinterPort -Name "${printerInfo.PortName}" | Select-Object Name, Description, PortMonitor, PortNumber | ConvertTo-Json`;

        let portInfo = null;
        try {
            const { stdout: portStdout } = await execAsync(`powershell.exe -Command "${portCommand}"`, {
                timeout: 5000,
                windowsHide: true
            });
            portInfo = JSON.parse(portStdout);
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
        console.error('[getPrinterDetails] erro:', err);
        res.status(500).send({message: 'Erro ao obter detalhes da impressora', detail: String(err?.message || err)});
    }
};
