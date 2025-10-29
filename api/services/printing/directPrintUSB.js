/**
 * Direct USB Printing using escpos-usb library
 * Sends raw ESC/POS commands directly to USB printer
 *
 * This uses escpos-usb which has better Windows compatibility
 * Falls back gracefully if native module fails to load
 */

let USB = null;
let escpos = null;

// Try to load USB libraries - fail gracefully if not available
try {
    USB = require('escpos-usb');
    escpos = require('escpos');
    console.log('[DirectUSB] escpos-usb library loaded successfully');
} catch (err) {
    console.warn('[DirectUSB] escpos-usb not available:', err.message);
    console.warn('[DirectUSB] USB direct printing will not be available. Use Network or Shared printing instead.');
}

/**
 * Check if USB printing is available
 * @returns {boolean}
 */
export function isUSBAvailable() {
    return USB !== null && escpos !== null;
}

/**
 * Print raw buffer to USB printer
 * @param {string} devicePath - Device identifier (VID:PID like "0x0425:0x0101" or empty for first printer)
 * @param {Buffer} buffer - Raw ESC/POS command buffer
 * @param {string} jobName - Job name for logging
 * @returns {Promise<void>}
 */
export async function printToUSB(devicePath, buffer, jobName = 'POS Ticket') {
    if (!isUSBAvailable()) {
        throw new Error('USB printing not available. Please install build tools by running install_script.ps1 as Administrator, then run: cd api && npm install');
    }

    return new Promise((resolve, reject) => {
        try {
            console.log(`[DirectUSB] Starting USB print job: ${jobName}`);
            console.log(`[DirectUSB] Device identifier: ${devicePath || 'auto-detect'}`);
            console.log(`[DirectUSB] Buffer size: ${buffer.length} bytes`);

            let device;

            // If VID:PID specified, try to find specific device
            if (devicePath && devicePath.includes(':')) {
                const [vidStr, pidStr] = devicePath.split(':');
                const vid = parseInt(vidStr, 16);
                const pid = parseInt(pidStr, 16);

                console.log(`[DirectUSB] Looking for VID=0x${vid.toString(16)}, PID=0x${pid.toString(16)}`);

                // Find device by VID/PID
                device = USB.findPrinter({
                    vid: vid,
                    pid: pid
                });

                if (!device) {
                    throw new Error(`USB printer not found with VID:PID=${devicePath}`);
                }
            } else {
                // Auto-detect first USB printer
                console.log('[DirectUSB] Auto-detecting first USB printer...');
                const devices = USB.findPrinter();

                if (!devices || (Array.isArray(devices) && devices.length === 0)) {
                    throw new Error('No USB printers found. Make sure printer is connected and powered on.');
                }

                device = Array.isArray(devices) ? devices[0] : devices;
            }

            console.log('[DirectUSB] USB device found, opening connection...');

            // Open device
            device.open((error) => {
                if (error) {
                    console.error('[DirectUSB] Failed to open USB device:', error);
                    reject(new Error(`Failed to open USB device: ${error.message}`));
                    return;
                }

                console.log('[DirectUSB] USB device opened successfully');

                // Create printer instance
                const printer = new escpos.Printer(device);

                // Write raw buffer
                try {
                    device.write(buffer);

                    // Give time for data to transfer
                    setTimeout(() => {
                        device.close(() => {
                            console.log(`[DirectUSB] ✓ Successfully printed to USB device`);
                            resolve();
                        });
                    }, 500);

                } catch (writeError) {
                    console.error('[DirectUSB] Write error:', writeError);
                    try {
                        device.close();
                    } catch (e) {
                        // Ignore close errors
                    }
                    reject(new Error(`USB write failed: ${writeError.message}`));
                }
            });

        } catch (err) {
            console.error('[DirectUSB] Print error:', err);
            reject(new Error(`USB print failed: ${err.message}`));
        }
    });
}

/**
 * List available USB printer devices
 * @returns {Promise<Array<{vid: string, pid: string, manufacturer: string, product: string, serialNumber: string, identifier: string}>>}
 */
export async function listUSBDevices() {
    console.log('[DirectUSB] Enumerating USB devices...');

    if (!isUSBAvailable()) {
        console.warn('[DirectUSB] USB library not available');
        return [];
    }

    try {
        // Get all USB printers
        const devices = USB.findPrinter();

        if (!devices) {
            console.log('[DirectUSB] No USB devices found');
            return [];
        }

        const deviceList = Array.isArray(devices) ? devices : [devices];
        console.log(`[DirectUSB] Found ${deviceList.length} USB device(s)`);

        const printers = [];

        for (const device of deviceList) {
            try {
                // Get device descriptor
                const vid = device.deviceDescriptor?.idVendor || 0;
                const pid = device.deviceDescriptor?.idProduct || 0;

                if (vid === 0 && pid === 0) {
                    console.warn('[DirectUSB] Skipping device with invalid VID/PID');
                    continue;
                }

                const identifier = `0x${vid.toString(16).padStart(4, '0')}:0x${pid.toString(16).padStart(4, '0')}`;

                // Try to get device strings
                let manufacturer = '';
                let product = '';
                let serialNumber = '';

                try {
                    device.open((err) => {
                        if (!err) {
                            manufacturer = device.deviceDescriptor?.iManufacturer || '';
                            product = device.deviceDescriptor?.iProduct || '';
                            serialNumber = device.deviceDescriptor?.iSerialNumber || '';
                            device.close();
                        }
                    });
                } catch (e) {
                    // Can't read strings, that's ok
                }

                printers.push({
                    vid: `0x${vid.toString(16).padStart(4, '0')}`,
                    pid: `0x${pid.toString(16).padStart(4, '0')}`,
                    manufacturer: manufacturer || 'Unknown',
                    product: product || 'USB Printer',
                    serialNumber: serialNumber || 'N/A',
                    identifier: identifier,
                    displayName: `${product || 'USB Printer'} (${identifier})`
                });

                console.log(`[DirectUSB] Found printer: ${product || 'Unknown'} [${identifier}]`);

            } catch (err) {
                console.warn(`[DirectUSB] Error inspecting device:`, err.message);
            }
        }

        console.log(`[DirectUSB] Total printers: ${printers.length}`);
        return printers;

    } catch (err) {
        console.error('[DirectUSB] Error listing USB devices:', err);
        return [];
    }
}

/**
 * Test USB device connectivity
 * @param {string} devicePath - Device identifier (VID:PID)
 * @returns {Promise<boolean>}
 */
export async function testUSBDevice(devicePath) {
    if (!isUSBAvailable()) {
        console.warn('[DirectUSB] USB library not available for testing');
        return false;
    }

    try {
        console.log(`[DirectUSB] Testing device: ${devicePath}`);

        if (!devicePath || !devicePath.includes(':')) {
            return false;
        }

        const [vidStr, pidStr] = devicePath.split(':');
        const vid = parseInt(vidStr, 16);
        const pid = parseInt(pidStr, 16);

        const device = USB.findPrinter({ vid, pid });

        if (!device) {
            console.log(`[DirectUSB] Device ${devicePath} not found`);
            return false;
        }

        // Try to open and close
        return new Promise((resolve) => {
            device.open((err) => {
                if (err) {
                    console.error(`[DirectUSB] Cannot open device: ${err.message}`);
                    resolve(false);
                } else {
                    device.close(() => {
                        console.log(`[DirectUSB] Device test successful`);
                        resolve(true);
                    });
                }
            });
        });

    } catch (err) {
        console.error(`[DirectUSB] Device test failed: ${err.message}`);
        return false;
    }
}
