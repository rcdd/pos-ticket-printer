import { execSync } from 'child_process';

try {
    const list = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
    const proc = list.find(p => p.name === 'api-pos');

    if (!proc) {
        console.log('[INFO] PM2 process "api-pos" not found. Starting...');
        try {
            execSync('pm2 delete all', { stdio: 'ignore' });
        } catch (_) {
            // No processes to delete
        }

        execSync('pm2 start ecosystem.config.cjs', { stdio: 'inherit' });
        execSync('pm2 save', { stdio: 'inherit' });
    } else {
        const status = proc.pm2_env.status;
        if (status !== 'online') {
            console.log(`[INFO] PM2 process is in state "${status}". Restarting...`);
            execSync('pm2 restart api-pos', { stdio: 'inherit' });
        } else {
            console.log('[OK] PM2 process "api-pos" is already running.');
        }
    }
} catch (err) {
    console.error('[WARN] PM2 check failed. Attempting fallback start from ecosystem.config.cjs...');
    try {
        execSync('pm2 start ecosystem.config.cjs', { stdio: 'inherit' });
        execSync('pm2 save', { stdio: 'inherit' });
    } catch (e) {
        console.error('[ERROR] Fallback start failed:', e.message);
    }
}
