/**
 * Direct Print Strategy
 * Main orchestrator for direct printing (bypasses OS print spooler)
 * Supports USB, Serial, and Network printers
 */

import { printToNetwork, testNetworkPrinter } from './directPrintNetwork.js';
import { printToUSB, listUSBDevices, testUSBDevice } from './directPrintUSB.js';

export class DirectPrintStrategy {
    /**
     * Print raw buffer using direct connection
     * @param {object} config - Printer configuration
     * @param {string} config.type - Connection type: 'usb', 'serial', 'network'
     * @param {string} [config.devicePath] - Device path for USB/Serial (e.g., "/dev/usb/lp0", "COM1")
     * @param {string} [config.ip] - Printer IP address for network
     * @param {number} [config.port] - Printer port for network (default: 9100)
     * @param {Buffer} buffer - Raw ESC/POS command buffer
     * @param {string} [jobName] - Job name for logging
     * @returns {Promise<void>}
     */
    async printRaw(config, buffer, jobName = 'POS Ticket') {
        if (!config || !config.type) {
            throw new Error('Direct print configuration missing or invalid');
        }

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            throw new Error('Invalid print buffer');
        }

        console.log(`[DirectPrint] Starting direct print - Type: ${config.type}, Job: ${jobName}`);

        try {
            switch (config.type.toLowerCase()) {
                case 'network':
                    await this.printNetwork(config, buffer, jobName);
                    break;

                case 'usb':
                case 'serial':
                    await this.printUSB(config, buffer, jobName);
                    break;

                default:
                    throw new Error(`Unsupported direct print type: ${config.type}`);
            }

            console.log(`[DirectPrint] Successfully completed direct print job: ${jobName}`);

        } catch (err) {
            console.error(`[DirectPrint] Failed to print: ${err.message}`);
            throw err;
        }
    }

    /**
     * Print to network printer
     * @private
     */
    async printNetwork(config, buffer, jobName) {
        if (!config.ip) {
            throw new Error('Network printer IP address is required');
        }

        const port = config.port || 9100;

        await printToNetwork(config.ip, port, buffer, jobName);
    }

    /**
     * Print to USB/Serial device
     * @private
     */
    async printUSB(config, buffer, jobName) {
        if (!config.devicePath) {
            throw new Error('USB/Serial device path is required');
        }

        await printToUSB(config.devicePath, buffer, jobName);
    }

    /**
     * Test direct printer connection
     * @param {object} config - Printer configuration
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testConnection(config) {
        if (!config || !config.type) {
            return {
                success: false,
                message: 'Invalid configuration'
            };
        }

        try {
            switch (config.type.toLowerCase()) {
                case 'network': {
                    if (!config.ip) {
                        return { success: false, message: 'IP address is required' };
                    }
                    const port = config.port || 9100;
                    const isOnline = await testNetworkPrinter(config.ip, port);
                    return {
                        success: isOnline,
                        message: isOnline
                            ? `Network printer at ${config.ip}:${port} is reachable`
                            : `Cannot connect to ${config.ip}:${port}`
                    };
                }

                case 'usb':
                case 'serial': {
                    if (!config.devicePath) {
                        return { success: false, message: 'Device path is required' };
                    }
                    const isAvailable = await testUSBDevice(config.devicePath);
                    return {
                        success: isAvailable,
                        message: isAvailable
                            ? `USB device ${config.devicePath} is available`
                            : `USB device ${config.devicePath} not found or not writable`
                    };
                }

                default:
                    return {
                        success: false,
                        message: `Unsupported connection type: ${config.type}`
                    };
            }
        } catch (err) {
            return {
                success: false,
                message: `Test failed: ${err.message}`
            };
        }
    }

    /**
     * List available USB/Serial devices
     * @returns {Promise<string[]>}
     */
    async listUSBDevices() {
        return await listUSBDevices();
    }
}

// Export singleton instance
export default new DirectPrintStrategy();
