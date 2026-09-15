import {Router} from 'express';
import os from 'os';
import {execFile} from 'child_process';
import db from '../db/index.js';
import {ensureLicenseState} from '../services/license.service.js';
import {readMultiTerminalSetting} from '../db/controllers/options.controller.js';
import {requireRole} from '../middleware/authorization.js';
import {UserRoles} from '../db/models/user.model.js';

const router = Router();

// Closes the kiosk browser on the POS machine itself. window.close() is
// blocked by browsers for windows they didn't open via script, so the UI's
// "Fechar aplicação" button asks the local API to kill Edge instead.
// Localhost-only: the kiosk can close itself; phones on the LAN cannot.
export const closeKiosk = (req, res) => {
    const ip = String(req.ip || '');
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.endsWith(':127.0.0.1');
    if (!isLocal) {
        return res.status(403).send({message: 'Apenas o próprio terminal pode fechar a aplicação.'});
    }
    if (process.platform !== 'win32') {
        return res.status(501).send({message: 'Fecho automático só disponível no Windows.'});
    }
    res.send('OK');
    // respond first — the kill takes down the window that made this request.
    // Kiosk may run on Edge or Chrome; kill whichever exists (errors ignored).
    setTimeout(() => {
        for (const image of ['msedge.exe', 'chrome.exe']) {
            execFile('taskkill', ['/F', '/IM', image], {windowsHide: true}, () => {});
        }
    }, 300);
};

// Lightweight public endpoint: tells the terminals whether they can work
// (multi-terminal active + register session open), without exposing sensitive data.
export const terminalStatus = async (req, res) => {
    try {
        const license = await ensureLicenseState();
        const licensed = Boolean(license.valid && license.features?.multi);
        const enabled = licensed ? await readMultiTerminalSetting() : false;
        const session = await db.sessions.findOne({where: {status: 'opened'}, attributes: ['id']});

        res.json({
            licenseValid: license.valid,
            multi: licensed && enabled,
            sessionOpen: Boolean(session),
        });
    } catch (error) {
        console.error('[system/terminal-status] error:', error);
        res.status(500).send({message: 'Não foi possível obter o estado do terminal.'});
    }
};

// Virtual adapters (Hyper-V, WSL, VPNs, VMs) are useless to the phones —
// they only produce pointless QR codes next to the real Wi-Fi/Ethernet.
const VIRTUAL_IFACE_PATTERN = /vethernet|default switch|wsl|hyper-v|virtualbox|vbox|vmware|docker|loopback|utun|tailscale|zerotier|bridge/i;
const isUsableAddress = (name, iface) =>
    iface.family === 'IPv4'
    && !iface.internal
    && !VIRTUAL_IFACE_PATTERN.test(name)
    && !iface.address.startsWith('169.254.'); // link-local (no DHCP)

function listLanAddresses(port) {
    const collect = (filter) => {
        const addresses = [];
        for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
            for (const iface of ifaces ?? []) {
                if (filter(name, iface)) {
                    addresses.push({
                        interface: name,
                        ip: iface.address,
                        terminalUrl: `http://${iface.address}:${port}/terminal`,
                    });
                }
            }
        }
        return addresses;
    };

    const usable = collect(isUsableAddress);
    if (usable.length > 0) {
        return usable;
    }
    // fallback: if the filter wipes everything (exotic setups), show what exists
    return collect((name, iface) => iface.family === 'IPv4' && !iface.internal);
}

router.get('/system/info', requireRole(UserRoles.ADMIN), async (req, res) => {
    try {
        const license = await ensureLicenseState();
        const licensed = Boolean(license.valid && license.features?.multi);
        const enabled = await readMultiTerminalSetting();
        const port = Number(process.env.NODE_DOCKER_PORT || 9393);

        res.json({
            port,
            mode: licensed && enabled ? 'multi' : 'mono',
            multiTerminal: {
                licensed,
                enabled,
                effective: licensed && enabled,
            },
            addresses: listLanAddresses(port),
        });
    } catch (error) {
        console.error('[system/info] error:', error);
        res.status(500).send({message: 'Não foi possível obter a informação do sistema.'});
    }
});

export default router;
