const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const output = fs.createWriteStream(path.join(__dirname, 'release.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`✅ Ficheiro release.zip criado com ${archive.pointer()} bytes`);
});

archive.on('error', err => {
    throw err;
});

archive.pipe(output);

// Inclui tudo exceto node_modules, release.zip e .git
archive.glob('**/*', {
    ignore: ['node_modules/**', 'release.zip', '.git/**']
});

archive.finalize();
