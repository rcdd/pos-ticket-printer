import {Buffer} from 'node:buffer';

const { default: lib } = await import('@printers/printers').catch(() => ({ default: null }));

if (!lib) {
    console.error('lib genérica não carregou');
    process.exit(1);
}

const api = (typeof lib === 'function') ? new lib() : lib;

const list = await api.getAllPrinters();
console.log('PRINTERS:', list.map(p => p.nativePrinter?.name || p.name));

const target = process.argv[2] ?? (list[0]?.nativePrinter?.name || list[0]?.name);
if (!target) throw new Error('Sem impressoras');

const escpos = Buffer.from([
    0x1B,0x40,                     // init
    ...Buffer.from('HELLO POS!\n'),// texto
    0x1B,0x64,0x02,                // feed 2 linhas
    0x1D,0x56,0x41,0x10            // partial cut
]);

const p = await api.getPrinterByName(target);
const fn = p.printBytes ?? p.printRaw ?? p.print ?? p.write;
if (!fn) throw new Error('sem método de impressão');

await fn.call(p, escpos, { jobName: 'Test', waitForCompletion: true });
console.log('DONE');
