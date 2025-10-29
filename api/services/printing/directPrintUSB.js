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

    try {
        if (process.platform === 'win32') {
            // Windows: List COM ports
            const { stdout } = await execAsync('powershell.exe -Command "[System.IO.Ports.SerialPort]::getportnames()"', {
                timeout: 5000,
                windowsHide: true
            });
            const ports = stdout.trim().split('\n').map(p => p.trim()).filter(Boolean);
            devices.push(...ports);

        } else {
            // Linux/macOS: Check common USB device paths
            const commonPaths = [
                '/dev/usb/lp0', '/dev/usb/lp1', '/dev/usb/lp2',
                '/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2',
                '/dev/ttyS0', '/dev/ttyS1',
                '/dev/cu.usbserial', '/dev/tty.usbserial',
                '/dev/cu.usbmodem', '/dev/tty.usbmodem'
            ];

            for (const devPath of commonPaths) {
                if (fs.existsSync(devPath)) {
                    devices.push(devPath);
                }
            }
        }
    } catch (err) {
        console.error(`[DirectPrint] Error listing USB devices: ${err.message}`);
    }

    return devices;
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
