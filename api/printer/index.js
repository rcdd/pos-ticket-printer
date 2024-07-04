const printer = require('@thiagoelg/node-printer');
const PrintJobs = require('./printJobs');
const cmds = require("./commands");

String.prototype.toBytes = function () {
    const arr = []
    for (let i = 0; i < this.length; i++) {
        arr.push(this[i].charCodeAt(0))
    }
    return arr;
}
let PRINTER_NAME = '_Metapace_T_3';

const printHeader = (printJob) => {
    const date = new Date().toISOString().replace(/T/, ' ').      // replace T with a space
        replace(/\..+/, '');

    printJob.newLine(3);
    printJob.setFont('A');
    printJob.setTextAlignment('center');
    printJob.text(date);
    printJob.setTextAlignment('left');
    printJob.setTextFormat('normal');
    printJob.setBold(true);
    printJob.setTextAlignment('center');
    printJob.newLine(1);
    printJob.separator();
    printJob.newLine(1);
    printJob.text("XVII Torneio de Freguesias");
    printJob.newLine(1);
    printJob.text("Rancho F.J.A. dos Conqueiros");
    printJob.newLine(1);
    printJob.separator();
    printJob.setTextAlignment('left');
    printJob.setBold(false);
    printJob.newLine(1);
    printJob.cut();
}

async function printText(printJob) {
    printer.printDirect({
        data: new Buffer.from(printJob.printData()),
        printer: PRINTER_NAME,
        type: 'RAW',
        success: function (jobID) {
            // console.log("sent to printer with ID: " + jobID);
        },
        error: function (err) {
            console.log(err);
        }
    });
}

async function printItem(productName) {
    return new Promise((resolve, reject) => {
        const printJob = new PrintJobs();
        printJob.setTextFormat('wide');
        printJob.newLine(2);
        printJob.text('1 ' + productName);
        printJob.setTextFormat('normal');
        printHeader(printJob);

        printText(printJob).then(r => {
            return true;
        });
    });
}

async function printTotal(cart) {
    const printJob = new PrintJobs();

    printJob.setTextFormat('normal');
    printJob.setFont('B');
    printJob.text('Pedido:');
    printJob.setFont('A');
    printJob.newLine(2);
    cart.items.forEach(item => {
        printJob.text(item.quantity + ' ' + item.name);
        printJob.newLine(1);
    });
    printJob.newLine(2);
    printJob.setFont('B');
    printJob.text('Total:' + cart.total);
    printJob.raw(cmds.EURO);
    printHeader(printJob);

    printText(printJob).then(r => {
        return true;
    });
}

async function printRequest(res, req) {
    const items = req.body.items;
    const cart = req.body.cart;

    for await (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
            await printItem(item.name);
        }
    }

    await printTotal(cart);
}

const getPrintConfig = (res, req) => {
// get from DB
}

const getPrinterList = (res, req) => {
    return res.send(printer.getPrinters());
}

module.exports = {
    printRequest,
    getPrintConfig,
    getPrinterList
}
