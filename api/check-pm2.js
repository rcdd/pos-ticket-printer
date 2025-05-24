const { execSync } = require('child_process');

try {
    const list = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }));
    const proc = list.find(p => p.name === 'api-pos');

    if (!proc) {
        console.log('api-pos not found. Starting...');
        execSync('pm2 start ecosystem.config.js');
        execSync('pm2 save');
    } else if (proc.pm2_env.status !== 'online') {
        console.log(`api-pos is ${proc.pm2_env.status}. Restarting...`);
        execSync('pm2 restart api-pos');
    } else {
        console.log('api-pos is running.');
    }
} catch (err) {
    console.error('PM2 status check failed. Restarting as fallback...');
    execSync('pm2 restart api-pos');
}
