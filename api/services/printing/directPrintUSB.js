/**
 * Direct USB/Serial Printing
 * Writes raw ESC/POS commands directly to device file or COM port
 *
 * Supported paths:
 * - Linux: /dev/usb/lp0, /dev/usb/lp1, /dev/ttyUSB0, /dev/ttyS0
 * - macOS: /dev/cu.usbserial, /dev/tty.usbserial
 * - Windows: COM1, COM2, etc. or \\.\USB#...
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Print raw buffer to USB/Serial device
 * @param {string} devicePath - Device path (e.g., "/dev/usb/lp0", "COM1")
 * @param {Buffer} buffer - Raw ESC/POS command buffer
 * @param {string} jobName - Job name for logging
 * @returns {Promise<void>}
 */
export async function printToUSB(devicePath, buffer, jobName = 'POS Ticket') {
    try {
        console.log(`[DirectPrint] Printing to USB device: ${devicePath} (${buffer.length} bytes) - Job: ${jobName}`);

        // For Windows COM ports, use a different approach
        if (process.platform === 'win32' && devicePath.toUpperCase().startsWith('COM')) {
            return await printToWindowsCOM(devicePath, buffer, jobName);
        }

        // For Unix-like systems (Linux, macOS)
        // Check if device exists
        if (!fs.existsSync(devicePath)) {
            throw new Error(`USB device not found: ${devicePath}`);
        }

        // Check if device is writable
        try {
            fs.accessSync(devicePath, fs.constants.W_OK);
        } catch (err) {
            throw new Error(`USB device not writable: ${devicePath}. Check permissions (try: sudo chmod 666 ${devicePath})`);
        }

        // Write directly to device file
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(devicePath, { flags: 'w' });

            writeStream.on('error', (err) => {
                reject(new Error(`Failed to write to USB device ${devicePath}: ${err.message}`));
            });

            writeStream.on('finish', () => {
                console.log(`[DirectPrint] Successfully wrote to ${devicePath}`);
                resolve();
            });

            writeStream.write(buffer, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                writeStream.end();
            });
        });

    } catch (err) {
        throw new Error(`USB print error: ${err.message}`);
    }
}

/**
 * Print to Windows COM port using PowerShell
 * @param {string} comPort - COM port (e.g., "COM1")
 * @param {Buffer} buffer - Raw buffer
 * @param {string} jobName - Job name
 * @returns {Promise<void>}
 */
async function printToWindowsCOM(comPort, buffer, jobName) {
    // Create temporary file with raw data
    const tempDir = process.env.TEMP || 'C:\\Temp';
    const tempFile = path.join(tempDir, `pos_print_${Date.now()}.bin`);

    try {
        // Write buffer to temp file
        fs.writeFileSync(tempFile, buffer);

        // Use PowerShell to copy file to COM port
        const psCommand = `Get-Content "${tempFile}" -Raw -Encoding Byte | Set-Content -Path "${comPort}" -Encoding Byte`;

        await execAsync(`powershell.exe -Command "${psCommand}"`, {
            timeout: 10000,
            windowsHide: true
        });

        console.log(`[DirectPrint] Successfully wrote to Windows ${comPort}`);

    } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

/**
 * List available USB/Serial devices
 * @returns {Promise<string[]>}
 */
export async function listUSBDevices() {
    const devices = [];
    console.log('[DirectPrint] Starting USB device detection...');
    console.log('[DirectPrint] Platform:', process.platform);

    try {
        if (process.platform === 'win32') {
            // Windows: Use WMI to find USB printers and COM ports
            console.log('[DirectPrint] Using Windows detection methods...');

            // Method 1: Query USB printers using WMI
            console.log('[DirectPrint] Method 1: Querying WMI for USB printers...');
            try {
                const wmiQuery = `Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE PortName LIKE 'USB%'" | Select-Object -ExpandProperty PortName`;
                const { stdout: usbPorts } = await execAsync(`powershell.exe -Command "${wmiQuery}"`, {
                    timeout: 5000,
                    windowsHide: true
                });

                const usbPortList = usbPorts.trim().split('\n').map(p => p.trim()).filter(Boolean);
                console.log('[DirectPrint] Method 1 found:', usbPortList);
                devices.push(...usbPortList);
            } catch (err) {
                console.log('[DirectPrint] WMI USB printer query failed:', err.message);
            }

            // Method 2: List COM ports (for USB-to-Serial adapters)
            console.log('[DirectPrint] Method 2: Listing COM ports...');
            try {
                const { stdout: comPorts } = await execAsync('powershell.exe -Command "[System.IO.Ports.SerialPort]::getportnames()"', {
                    timeout: 5000,
                    windowsHide: true
                });
                const ports = comPorts.trim().split('\n').map(p => p.trim()).filter(Boolean);
                console.log('[DirectPrint] Method 2 found:', ports);
                devices.push(...ports);
            } catch (err) {
                console.log('[DirectPrint] COM port listing failed:', err.message);
            }

            // Method 3: Query USB devices using WMIC
            console.log('[DirectPrint] Method 3: Querying WMIC for USB devices...');
            try {
                const wmicQuery = `wmic path Win32_USBControllerDevice get Dependent | findstr "USB"`;
                const { stdout: usbDevices } = await execAsync(wmicQuery, {
                    timeout: 5000,
                    windowsHide: true
                });

                // Extract device paths from output
                const usbDeviceMatches = usbDevices.match(/USB\\[^\\"]+/g);
                console.log('[DirectPrint] Method 3 found:', usbDeviceMatches || []);
                if (usbDeviceMatches) {
                    devices.push(...usbDeviceMatches.map(d => `USB:${d}`));
                }
            } catch (err) {
                console.log('[DirectPrint] WMIC USB device query failed:', err.message);
            }

            // Method 4: Check if printers library can detect USB
            console.log('[DirectPrint] Method 4: Using @printers/printers library...');
            try {
                const { default: printersLib } = await import('@printers/printers');
                const allPrinters = await printersLib.getAllPrinters();

                // Filter USB printers
                const usbPrinters = allPrinters.filter(p =>
                    p.portName && (
                        p.portName.toUpperCase().includes('USB') ||
                        p.connection?.toUpperCase().includes('USB')
                    )
                );

                console.log('[DirectPrint] Method 4 found USB printers:', usbPrinters.map(p => p.name || p.portName));
                usbPrinters.forEach(p => {
                    const identifier = p.portName || p.name;
                    if (identifier && !devices.includes(identifier)) {
                        devices.push(`PRINTER:${identifier}`);
                    }
                });
            } catch (err) {
                console.log('[DirectPrint] @printers/printers USB detection failed:', err.message);
            }

        } else {
            // Linux/macOS: Check common USB device paths
            const commonPaths = [
                '/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2', '/dev/usb/lp3',
                '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2', '/dev/ttyUSB3',
                '/dev/ttyS0', '/dev/ttyS1', '/dev/ttyS2',
                '/dev/cu.usbserial', '/dev/tty.usbserial',
                '/dev/cu.usbmodem', '/dev/tty.usbmodem',
                '/dev/ttyACM0', '/dev/ttyACM1'
            ];

            for (const devPath of commonPaths) {
                if (fs.existsSync(devPath)) {
                    devices.push(devPath);
                }
            }

            // Try to use lsusb if available
            try {
                const { stdout } = await execAsync('lsusb 2>/dev/null', {
                    timeout: 3000
                });
                if (stdout && stdout.includes('Printer')) {
                    // Found printer in lsusb output
                    console.log('[DirectPrint] USB Printer detected via lsusb');
                }
            } catch (err) {
                // lsusb not available or failed
            }
        }
    } catch (err) {
        console.error(`[DirectPrint] Error listing USB devices: ${err.message}`);
    }

    // Remove duplicates
    const uniqueDevices = [...new Set(devices)];
    console.log('[DirectPrint] Total USB devices found:', uniqueDevices.length);
    console.log('[DirectPrint] Devices:', uniqueDevices);
    return uniqueDevices;
}

/**
 * Test USB device connectivity
 * @param {string} devicePath - Device path
 * @returns {Promise<boolean>}
 */
export async function testUSBDevice(devicePath) {
    try {
        if (process.platform === 'win32' && devicePath.toUpperCase().startsWith('COM')) {
            // For Windows COM ports, just check if it exists in the list
            const devices = await listUSBDevices();
            return devices.includes(devicePath.toUpperCase());
        }

        // For Unix-like systems, check if file exists and is writable
        return fs.existsSync(devicePath) &&
               (() => {
                   try {
                       fs.accessSync(devicePath, fs.constants.W_OK);
                       return true;
                   } catch {
                       return false;
                   }
               })();
    } catch {
        return false;
    }
}
