import 'dotenv/config';

import app, {ensureDatabaseSchema} from './app.js';
import db from './db/index.js';
import {initLicenseState} from './services/license.service.js';

const PORT = process.env.NODE_DOCKER_PORT || 9393;

async function startServer() {
    try {
        await db.sequelize.authenticate();
        console.log('Database connection established.');

        await ensureDatabaseSchema();

        const licenseState = await initLicenseState();
        if (!licenseState.valid) {
            console.warn(`[license] ${licenseState.message}`);
        } else {
            console.log(`[license] Active for tenant ${licenseState.tenant} until ${licenseState.expiresAtIso}`);
        }
    } catch (err) {
        console.error('Unable to connect to the database:', err);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
    });
}

startServer();
