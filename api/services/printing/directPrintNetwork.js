/**
 * Direct Network Printing
 * Sends raw ESC/POS commands directly to network printer via TCP socket
 * Typical port: 9100 (raw printing port)
 */

import net from 'net';

/**
 * Print raw buffer to network printer
 * @param {string} ip - Printer IP address (e.g., "192.168.1.100")
 * @param {number} port - Printer port (default: 9100)
 * @param {Buffer} buffer - Raw ESC/POS command buffer
 * @param {string} jobName - Job name for logging
 * @returns {Promise<void>}
 */
export async function printToNetwork(ip, port, buffer, jobName = 'POS Ticket') {
    return new Promise((resolve, reject) => {
        const timeout = 10000; // 10 second timeout

        const client = new net.Socket();

        // Set timeout
        client.setTimeout(timeout);

        client.on('timeout', () => {
            client.destroy();
            reject(new Error(`Network print timeout after ${timeout}ms connecting to ${ip}:${port}`));
        });

        client.on('error', (err) => {
            reject(new Error(`Network print error to ${ip}:${port}: ${err.message}`));
        });

        client.on('close', () => {
            resolve();
        });

        client.connect(port, ip, () => {
            console.log(`[DirectPrint] Connected to printer at ${ip}:${port} for job: ${jobName}`);

            // Send the raw buffer
            client.write(buffer, (err) => {
                if (err) {
                    client.destroy();
                    reject(new Error(`Failed to write to network printer: ${err.message}`));
                    return;
                }

                console.log(`[DirectPrint] Sent ${buffer.length} bytes to ${ip}:${port}`);

                // Close connection after a short delay to ensure data is sent
                setTimeout(() => {
                    client.end();
                }, 500);
            });
        });
    });
}

/**
 * Test network printer connectivity
 * @param {string} ip - Printer IP address
 * @param {number} port - Printer port
 * @returns {Promise<boolean>}
 */
export async function testNetworkPrinter(ip, port) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(3000);

        client.on('timeout', () => {
            client.destroy();
            resolve(false);
        });

        client.on('error', () => {
            resolve(false);
        });

        client.connect(port, ip, () => {
            client.end();
            resolve(true);
        });
    });
}
