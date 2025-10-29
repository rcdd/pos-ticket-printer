/**
 * Direct Printing using node-thermal-printer library
 * Supports USB, Network, and Serial connections
 *
 * USB requires native modules (may not work on all Windows setups)
 * Network works without any native compilation!
 */

import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

let usbAvailable = false;

// Check if USB support is available
try {
    // Try to load USB module
    const usb = await import('usb');
    usbAvailable = true;
    console.log('[DirectPrint] ✓ USB support available');
} catch (err) {
    console.warn('[DirectPrint] ⚠ USB support not available:', err.message);
    console.warn('[DirectPrint] Network and Serial printing will still work!');
}

/**
 * Check if USB printing is available
 * @returns {boolean}
 */
export function isUSBAvailable() {
    return usbAvailable;
}

/**
 * Print raw buffer to printer
 * @param {string} devicePath - Device identifier or IP address
 * @param {Buffer} buffer - Raw ESC/POS command buffer
 * @param {string} jobName - Job name for logging
 * @param {string} connectionType - 'usb', 'network', or 'serial'
 * @param {number} port - Port number for network printing (default 9100)
 * @returns {Promise<void>}
 */
export async function printDirect(devicePath, buffer, jobName = 'POS Ticket', connectionType = 'usb', port = 9100) {
    try {
        console.log(`[DirectPrint] Print job: ${jobName}`);
        console.log(`[DirectPrint] Connection: ${connectionType}`);
        console.log(`[DirectPrint] Device: ${devicePath || 'auto-detect'}`);
        console.log(`[DirectPrint] Buffer size: ${buffer.length} bytes`);

        let printer;

        // Configure printer based on connection type
        switch (connectionType.toLowerCase()) {
            case 'network':
                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,  // Most POS printers are EPSON compatible
                    interface: `tcp://${devicePath}:${port}`,
                    options: {
                        timeout: 5000
                    }
                });
                console.log(`[DirectPrint] Using network connection: ${devicePath}:${port}`);
                break;

            case 'serial':
            case 'com':
                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: devicePath,  // e.g., "COM1" or "/dev/ttyUSB0"
                    options: {
                        baudRate: 9600
                    }
                });
                console.log(`[DirectPrint] Using serial connection: ${devicePath}`);
                break;

            case 'usb':
                if (!usbAvailable) {
                    throw new Error('USB printing not available. Install build tools by running: install_script.ps1 as Administrator, then: cd api && npm install. OR use Network printing instead (faster and easier!)');
                }

                // Parse VID:PID if provided
                let vendorId, productId;
                if (devicePath && devicePath.includes(':')) {
                    const [vid, pid] = devicePath.split(':');
                    vendorId = parseInt(vid, 16);
                    productId = parseInt(pid, 16);
                }

                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: 'usb',
                    options: {
                        vendorId: vendorId,
                        productId: productId
                    }
                });
                console.log(`[DirectPrint] Using USB connection${devicePath ? `: ${devicePath}` : ' (auto-detect)'}`);
                break;

            default:
                throw new Error(`Unknown connection type: ${connectionType}`);
        }

        // Send raw buffer directly
        await printer.execute();
        await printer.raw(buffer);

        console.log(`[DirectPrint] ✓ Print job completed successfully`);

    } catch (err) {
        console.error('[DirectPrint] Print error:', err);

        // Provide helpful error messages
        if (err.message.includes('ECONNREFUSED')) {
            throw new Error(`Cannot connect to printer at ${devicePath}:${port}. Check if printer is powered on and connected to network.`);
        } else if (err.message.includes('ETIMEDOUT')) {
            throw new Error(`Connection to printer timed out. Check network connection and printer IP address.`);
        } else if (err.message.includes('USB')) {
            throw new Error(`USB error: ${err.message}. Try Network printing instead for better reliability.`);
        } else {
            throw new Error(`Print failed: ${err.message}`);
        }
    }
}

/**
 * Print to USB printer (backward compatibility)
 * @param {string} devicePath - VID:PID like "0x0425:0x0101"
 * @param {Buffer} buffer - Raw ESC/POS buffer
 * @param {string} jobName - Job name
 */
export async function printToUSB(devicePath, buffer, jobName = 'POS Ticket') {
    return printDirect(devicePath, buffer, jobName, 'usb');
}

/**
 * List available USB printer devices
 * @returns {Promise<Array>}
 */
export async function listUSBDevices() {
    console.log('[DirectPrint] Listing USB devices...');

    if (!usbAvailable) {
        console.warn('[DirectPrint] USB support not available');
        console.warn('[DirectPrint] To enable USB: Run install_script.ps1 as Administrator, then: cd api && npm install');
        return [];
    }

    try {
        // Import usb dynamically
        const { default: usb } = await import('usb');

        const devices = usb.getDeviceList();
        const printers = [];

        console.log(`[DirectPrint] Found ${devices.length} USB devices`);

        // Filter for printer devices (class 7)
        for (const device of devices) {
            try {
                const descriptor = device.deviceDescriptor;
                const vid = descriptor.idVendor;
                const pid = descriptor.idProduct;

                // Check if it's a printer (class 7) or common POS vendor
                const isPrinter = descriptor.bDeviceClass === 7 ||
                                 vid === 0x04b8 || // Epson
                                 vid === 0x0519 || // Star
                                 vid === 0x0425 || // Zjiang (POS-80)
                                 vid === 0x20d1;   // Rongta

                if (!isPrinter) continue;

                let product = 'USB Printer';
                let manufacturer = 'Unknown';

                try {
                    device.open();

                    if (descriptor.iProduct) {
                        product = device.getStringDescriptor(descriptor.iProduct) || product;
                    }
                    if (descriptor.iManufacturer) {
                        manufacturer = device.getStringDescriptor(descriptor.iManufacturer) || manufacturer;
                    }

                    device.close();
                } catch (e) {
                    // Can't read strings, use defaults
                }

                const identifier = `0x${vid.toString(16).padStart(4, '0')}:0x${pid.toString(16).padStart(4, '0')}`;

                printers.push({
                    vid: `0x${vid.toString(16).padStart(4, '0')}`,
                    pid: `0x${pid.toString(16).padStart(4, '0')}`,
                    manufacturer: manufacturer,
                    product: product,
                    identifier: identifier,
                    displayName: `${product} (${identifier})`
                });

                console.log(`[DirectPrint] Found: ${product} [${identifier}]`);

            } catch (err) {
                console.warn(`[DirectPrint] Error checking device:`, err.message);
            }
        }

        console.log(`[DirectPrint] Total printers found: ${printers.length}`);
        return printers;

    } catch (err) {
        console.error('[DirectPrint] Error listing USB devices:', err);
        return [];
    }
}

/**
 * Test device connectivity
 * @param {string} devicePath - Device path or IP
 * @param {string} connectionType - 'usb', 'network', or 'serial'
 * @param {number} port - Port for network (default 9100)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testConnection(devicePath, connectionType = 'usb', port = 9100) {
    try {
        console.log(`[DirectPrint] Testing ${connectionType} connection to: ${devicePath}`);

        let printer;

        switch (connectionType.toLowerCase()) {
            case 'network':
                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: `tcp://${devicePath}:${port}`,
                    options: {
                        timeout: 3000
                    }
                });
                break;

            case 'serial':
            case 'com':
                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: devicePath
                });
                break;

            case 'usb':
                if (!usbAvailable) {
                    return {
                        success: false,
                        message: 'USB support not available. Install build tools or use Network printing.'
                    };
                }

                let vendorId, productId;
                if (devicePath && devicePath.includes(':')) {
                    const [vid, pid] = devicePath.split(':');
                    vendorId = parseInt(vid, 16);
                    productId = parseInt(pid, 16);
                }

                printer = new ThermalPrinter({
                    type: PrinterTypes.EPSON,
                    interface: 'usb',
                    options: {
                        vendorId,
                        productId
                    }
                });
                break;

            default:
                return {
                    success: false,
                    message: `Unknown connection type: ${connectionType}`
                };
        }

        // Try to initialize connection
        await printer.execute();

        console.log(`[DirectPrint] ✓ Connection test successful`);

        return {
            success: true,
            message: `✓ Connected successfully to ${connectionType} printer`
        };

    } catch (err) {
        console.error(`[DirectPrint] Connection test failed:`, err);

        let message = err.message;
        if (err.message.includes('ECONNREFUSED')) {
            message = 'Cannot connect. Check if printer is powered on and network settings are correct.';
        } else if (err.message.includes('ETIMEDOUT')) {
            message = 'Connection timeout. Check IP address and network connection.';
        }

        return {
            success: false,
            message: `✗ Connection failed: ${message}`
        };
    }
}

/**
 * Test USB device (backward compatibility)
 */
export async function testUSBDevice(devicePath) {
    const result = await testConnection(devicePath, 'usb');
    return result.success;
}
