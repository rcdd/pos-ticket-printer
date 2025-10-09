export default {
    apps: [
        {
            name: 'api-pos',
            script: 'server.js',
            cwd: import.meta.dirname,
            env: {
                NODE_ENV: 'production',
                PORT: 9393
            }
        }
    ]
};
