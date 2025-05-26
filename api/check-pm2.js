const { execSync } = require('child_process');

try {
    const list = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
    const proc = list.find(p => p.name === 'api-pos');

    if (!proc) {
        console.log('❌ api-pos not found. Starting fresh...');
        try {
            execSync('pm2 delete all', { stdio: 'ignore' });
        } catch (_) {
            // no processes to delete
        }

        execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
        execSync('pm2 save', { stdio: 'inherit' });
    } else {
        const status = proc.pm2_env.status;
        if (status !== 'online') {
            console.log(`🔄 api-pos is in state '${status}'. Restarting...`);
            execSync('pm2 restart api-pos', { stdio: 'inherit' });
        } else {
            console.log('✅ api-pos is already running.');
        }
    }
} catch (err) {
    console.error('⚠️ PM2 check failed. Trying to start from ecosystem.config.js as fallback...');
    try {
        execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
        execSync('pm2 save', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Fallback start also failed:', e.message);
    }
}
