const printer = require('@thiagoelg/node-printer');
const PrintJobs = require('./lib/printJobs');
const cmds = require("./lib/commands");

const db = require("../../models");
const Option = db.options;
const Op = db.Sequelize.Op;

let PRINTER_NAME = 'undefined';
let HEADERS = {
    firstLine: "Undefined",
    secondLine: "Undefined"
}

String.prototype.toBytes = function () {
    const arr = []
    for (let i = 0; i < this.length; i++) {
        arr.push(this[i].charCodeAt(0))
    }
    return arr;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
    printJob.text(HEADERS.firstLine);
    if (HEADERS.secondLine) {
        printJob.newLine(1);
        printJob.text(HEADERS.secondLine);    
    }
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
            //console.log("sent to printer " + PRINTER_NAME + " with ID: " + jobID);
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
            resolve();
        });
    });
}

async function printTotal(cart) {
    return new Promise((resolve, reject) => {
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
            return resolve();
        });
    });
}

exports.printRequest = async(req, res) => {
    const items = req.body.items;
    const cart = req.body.cart;
    PRINTER_NAME = req.body.printer;
    HEADERS = req.body.headers;

    for await (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
            await printItem(item.name);
        }
    }

    await printTotal(cart);
    
    await delay(2000);

    return res.send("OK");
}

exports.getPrintName = async (res, req) => {
    return Option.findOne({
        where: {
            name: "printer"
        }
    })
        .then(data => {
            if (data) {
                return data.value;
            } else {
                throw new Error("Printer not found !!");
            }
        })
        .catch(err => {
            throw new Error("Error retrieving printer");
        });
}

exports.getPrinterList = async (res, req) => {
    var printers = await printer.getPrinters();
    return req.send(printers);
}
