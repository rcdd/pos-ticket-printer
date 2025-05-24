module.exports = {
    apps: [
        {
            name: 'api-pos',
            script: 'server.js',
            cwd: __dirname,
            env: {
                NODE_ENV: 'production',
                PORT: 9393
            }
        }
    ]
};
