/**
 * Direct USB Printing using node-usb library
 * Sends raw ESC/POS commands directly to USB printer
 *
 * Requires:
 * - Python (for node-gyp compilation)
 * - Visual Studio Build Tools (Windows)
 * - libusb (Linux/Mac)
 */

import usb from 'usb';

// Common VID/PIDs for ESC/POS printers
const COMMON_PRINTER_VENDORS = [
    { vid: 0x04b8, name: 'Epson' },           // Epson
    { vid: 0x0519, name: 'Star Micronics' },  // Star
    { vid: 0x0fe6, name: 'ICS Advent' },      // Generic POS
    { vid: 0x0416, name: 'Winbond' },         // Generic
    { vid: 0x1504, name: 'Citizen' },         // Citizen
    { vid: 0x154f, name: 'Wincor Nixdorf' },  // Wincor
    { vid: 0x0dd4, name: 'Custom' },          // Custom Engineering
    { vid: 0x20d1, name: 'Rongta' },          // Rongta
    { vid: 0x0425, name: 'Zjiang' },          // Zjiang (POS-80 Series often uses this)
    { vid: 0x28e9, name: 'GS' }               // Generic POS
];

/**
 * Find USB printer device by VID/PID or device path
 * @param {string} deviceIdentifier - Either "VID:PID" (e.g., "0x0425:0x0101") or device address
 * @returns {Promise<usb.Device|null>}
 */
async function findUSBDevice(deviceIdentifier) {
    try {
        console.log(`[DirectUSB] Searching for device: ${deviceIdentifier}`);

        // If deviceIdentifier is VID:PID format
        if (deviceIdentifier.includes(':')) {
            const [vidStr, pidStr] = deviceIdentifier.split(':');
            const vid = parseInt(vidStr, 16);
            const pid = parseInt(pidStr, 16);

            console.log(`[DirectUSB] Looking for VID=0x${vid.toString(16).padStart(4, '0')}, PID=0x${pid.toString(16).padStart(4, '0')}`);

            const device = usb.findByIds(vid, pid);
            if (device) {
                console.log(`[DirectUSB] Found device with VID:PID=${vidStr}:${pidStr}`);
                return device;
            }
            return null;
        }

        // Otherwise, try to find any printer
        console.log('[DirectUSB] Searching for any ESC/POS printer...');
        const devices = usb.getDeviceList();

        for (const device of devices) {
            const descriptor = device.deviceDescriptor;
            const vid = descriptor.idVendor;
            const pid = descriptor.idProduct;

            // Check if it's a known printer vendor
            const vendor = COMMON_PRINTER_VENDORS.find(v => v.vid === vid);
            if (vendor) {
                console.log(`[DirectUSB] Found ${vendor.name} printer: VID=0x${vid.toString(16)}, PID=0x${pid.toString(16)}`);
                return device;
            }

            // Check if device class indicates a printer (class 7)
            if (descriptor.bDeviceClass === 7 || descriptor.bDeviceClass === 0) {
                try {
                    device.open();
                    const config = device.configDescriptor;
                    device.close();

                    if (config && config.interfaces) {
                        for (const iface of config.interfaces) {
                            for (const alt of iface) {
                                if (alt.bInterfaceClass === 7) { // Printer class
                                    console.log(`[DirectUSB] Found printer device: VID=0x${vid.toString(16)}, PID=0x${pid.toString(16)}`);
                                    return device;
                                }
                            }
                        }
                    }
                } catch (err) {
                    // Can't open device, skip
                    console.log(`[DirectUSB] Could not inspect device VID=0x${vid.toString(16)}: ${err.message}`);
                }
            }
        }

        return null;
    } catch (err) {
        console.error('[DirectUSB] Error finding device:', err);
        return null;
    }
}

/**
 * Print raw buffer to USB printer
 * @param {string} devicePath - Device identifier (VID:PID or "auto" to find first printer)
 * @param {Buffer} buffer - Raw ESC/POS command buffer
 * @param {string} jobName - Job name for logging
 * @returns {Promise<void>}
 */
export async function printToUSB(devicePath, buffer, jobName = 'POS Ticket') {
    let device = null;
    let iface = null;
    let endpoint = null;

    try {
        console.log(`[DirectUSB] Starting USB print job: ${jobName}`);
        console.log(`[DirectUSB] Device path: ${devicePath}`);
        console.log(`[DirectUSB] Buffer size: ${buffer.length} bytes`);

        // Find the device
        device = await findUSBDevice(devicePath === 'auto' ? '' : devicePath);

        if (!device) {
            throw new Error(`USB printer device not found: ${devicePath}`);
        }

        console.log(`[DirectUSB] Opening device...`);
        device.open();

        // Get configuration
        const config = device.configDescriptor;
        if (!config || !config.interfaces || config.interfaces.length === 0) {
            throw new Error('No interfaces found on USB device');
        }

        console.log(`[DirectUSB] Device has ${config.interfaces.length} interface(s)`);

        // Find printer interface (class 7) and OUT endpoint
        let interfaceNumber = -1;
        let endpointAddress = -1;

        for (let i = 0; i < config.interfaces.length; i++) {
            const ifaceDescriptors = config.interfaces[i];
            for (const altSetting of ifaceDescriptors) {
                console.log(`[DirectUSB] Checking interface ${altSetting.bInterfaceNumber}, class ${altSetting.bInterfaceClass}`);

                // Look for printer class (7) or vendor-specific (255)
                if (altSetting.bInterfaceClass === 7 || altSetting.bInterfaceClass === 255) {
                    // Find OUT endpoint (direction: HOST -> DEVICE)
                    for (const ep of altSetting.endpoints) {
                        const direction = ep.bEndpointAddress & 0x80;
                        if (direction === 0) { // OUT endpoint
                            interfaceNumber = altSetting.bInterfaceNumber;
                            endpointAddress = ep.bEndpointAddress;
                            console.log(`[DirectUSB] Found OUT endpoint: interface=${interfaceNumber}, endpoint=0x${endpointAddress.toString(16)}`);
                            break;
                        }
                    }
                }
                if (interfaceNumber >= 0) break;
            }
            if (interfaceNumber >= 0) break;
        }

        if (interfaceNumber < 0 || endpointAddress < 0) {
            throw new Error('No suitable printer interface or OUT endpoint found');
        }

        // Claim interface
        console.log(`[DirectUSB] Claiming interface ${interfaceNumber}...`);
        iface = device.interface(interfaceNumber);

        // Detach kernel driver if needed (Linux)
        if (process.platform === 'linux' && iface.isKernelDriverActive()) {
            console.log('[DirectUSB] Detaching kernel driver...');
            iface.detachKernelDriver();
        }

        iface.claim();

        // Get endpoint
        endpoint = iface.endpoint(endpointAddress);

        if (!endpoint || endpoint.direction !== 'out') {
            throw new Error(`Endpoint 0x${endpointAddress.toString(16)} is not an OUT endpoint`);
        }

        console.log(`[DirectUSB] Sending ${buffer.length} bytes to printer...`);

        // Transfer data
        await new Promise((resolve, reject) => {
            endpoint.transfer(buffer, (error) => {
                if (error) {
                    reject(new Error(`USB transfer error: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });

        console.log(`[DirectUSB] ✓ Successfully printed to USB device`);

    } catch (err) {
        console.error('[DirectUSB] Print error:', err);
        throw new Error(`USB print failed: ${err.message}`);
    } finally {
        // Clean up
        try {
            if (iface) {
                console.log('[DirectUSB] Releasing interface...');
                iface.release(() => {
                    // Re-attach kernel driver if needed
                    if (process.platform === 'linux') {
                        try {
                            iface.attachKernelDriver();
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                });
            }
            if (device) {
                console.log('[DirectUSB] Closing device...');
                device.close();
            }
        } catch (cleanupErr) {
            console.warn('[DirectUSB] Cleanup error:', cleanupErr.message);
        }
    }
}

/**
 * List available USB printer devices
 * @returns {Promise<Array<{vid: string, pid: string, manufacturer: string, product: string, serialNumber: string, identifier: string}>>}
 */
export async function listUSBDevices() {
    console.log('[DirectUSB] Enumerating USB devices...');

    const printers = [];
    const devices = usb.getDeviceList();

    console.log(`[DirectUSB] Found ${devices.length} total USB devices`);

    for (const device of devices) {
        try {
            const descriptor = device.deviceDescriptor;
            const vid = descriptor.idVendor;
            const pid = descriptor.idProduct;

            // Check if it's a printer (class 7) or known vendor
            const isKnownVendor = COMMON_PRINTER_VENDORS.some(v => v.vid === vid);
            const isPrinterClass = descriptor.bDeviceClass === 7;

            let isPrinter = isKnownVendor || isPrinterClass;

            // If not obvious, check interface class
            if (!isPrinter && descriptor.bDeviceClass === 0) {
                try {
                    device.open();
                    const config = device.configDescriptor;

                    if (config && config.interfaces) {
                        for (const iface of config.interfaces) {
                            for (const alt of iface) {
                                if (alt.bInterfaceClass === 7) {
                                    isPrinter = true;
                                    break;
                                }
                            }
                            if (isPrinter) break;
                        }
                    }
                    device.close();
                } catch (err) {
                    // Can't inspect, skip
                    continue;
                }
            }

            if (!isPrinter) {
                continue;
            }

            // Get device strings
            let manufacturer = '';
            let product = '';
            let serialNumber = '';

            try {
                device.open();

                if (descriptor.iManufacturer) {
                    manufacturer = await new Promise((resolve) => {
                        device.getStringDescriptor(descriptor.iManufacturer, (err, data) => {
                            resolve(err ? '' : data);
                        });
                    });
                }

                if (descriptor.iProduct) {
                    product = await new Promise((resolve) => {
                        device.getStringDescriptor(descriptor.iProduct, (err, data) => {
                            resolve(err ? '' : data);
                        });
                    });
                }

                if (descriptor.iSerialNumber) {
                    serialNumber = await new Promise((resolve) => {
                        device.getStringDescriptor(descriptor.iSerialNumber, (err, data) => {
                            resolve(err ? '' : data);
                        });
                    });
                }

                device.close();
            } catch (err) {
                console.warn(`[DirectUSB] Could not read strings for VID=0x${vid.toString(16)}: ${err.message}`);
            }

            const vendorInfo = COMMON_PRINTER_VENDORS.find(v => v.vid === vid);
            const identifier = `0x${vid.toString(16).padStart(4, '0')}:0x${pid.toString(16).padStart(4, '0')}`;

            printers.push({
                vid: `0x${vid.toString(16).padStart(4, '0')}`,
                pid: `0x${pid.toString(16).padStart(4, '0')}`,
                manufacturer: manufacturer || vendorInfo?.name || 'Unknown',
                product: product || 'USB Printer',
                serialNumber: serialNumber || 'N/A',
                identifier: identifier,
                displayName: `${product || 'USB Printer'} (${identifier})`
            });

            console.log(`[DirectUSB] Found printer: ${product || 'Unknown'} [${identifier}]`);

        } catch (err) {
            console.warn(`[DirectUSB] Error inspecting device: ${err.message}`);
        }
    }

    console.log(`[DirectUSB] Total printers found: ${printers.length}`);
    return printers;
}

/**
 * Test USB device connectivity
 * @param {string} devicePath - Device identifier (VID:PID)
 * @returns {Promise<boolean>}
 */
export async function testUSBDevice(devicePath) {
    try {
        console.log(`[DirectUSB] Testing device: ${devicePath}`);
        const device = await findUSBDevice(devicePath);

        if (!device) {
            return false;
        }

        // Try to open and close
        device.open();
        const descriptor = device.deviceDescriptor;
        device.close();

        console.log(`[DirectUSB] Device test successful: VID=0x${descriptor.idVendor.toString(16)}, PID=0x${descriptor.idProduct.toString(16)}`);
        return true;
    } catch (err) {
        console.error(`[DirectUSB] Device test failed: ${err.message}`);
        return false;
    }
}
