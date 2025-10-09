import fs from 'node:fs';
import path from 'node:path';

const base = path.join('node_modules','@printers');
const winPkg = path.join(base,'printers-win32-x64-msvc','package.json');
if (fs.existsSync(winPkg)) {
    const json = JSON.parse(fs.readFileSync(winPkg, 'utf8'));
    if (json.type !== 'module') {
        json.type = 'module';
        fs.writeFileSync(winPkg, JSON.stringify(json, null, 2));
        console.log('[patch] set type=module -> printers-win32-x64-msvc');
    }
}

// cria shim se o pacote base o exigir
const shim = path.join(base,'printers','npm','win32-x64-msvc','index.js');
if (!fs.existsSync(shim)) {
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.writeFileSync(
        shim,
        "export * from '@printers/printers-win32-x64-msvc';\nexport { default } from '@printers/printers-win32-x64-msvc';\n"
    );
    console.log('[patch] created shim -> printers/npm/win32-x64-msvc/index.js');
}
