const express = require('express');
const bodyParser = require('body-parser')
const printer = require('@thiagoelg/node-printer');
const PrintJobs = require('./printJobs');
const cmds = require("./commands");

const app = express();
const port = process.env.PORT || 5000;
const jsonParser = bodyParser.json()

String.prototype.toBytes = function () {
    const arr = []
    for (let i = 0; i < this.length; i++) {
        arr.push(this[i].charCodeAt(0))
    }
    return arr;
}

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
    printJob.text("Rancho F.J.A. dos Conqueiros");
    printJob.newLine(1);
    printJob.text("46º Aniversário");
    printJob.newLine(1);
    printJob.separator();
    printJob.setTextAlignment('left');
    printJob.setBold(false);
    printJob.newLine(1);
    printJob.cut();
}

async function printItem(productName) {
    const printJob = new PrintJobs();
    printJob.setTextFormat('normal');
    printJob.setFont('B');
    printJob.newLine(2);
    printJob.text('1 ' + productName);
    printHeader(printJob);

    printer.printDirect({
        data: new Buffer.from(printJob.printData()),
        printer: '_Metapace_T_3',
        type: 'RAW',
        success: function (jobID) {
            console.log("sent to printer with ID: " + jobID);
        },
        error: function (err) {
            console.log(err);
        }
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

    printer.printDirect({
        data: new Buffer.from(printJob.printData()),
        printer: '_Metapace_T_3',
        type: 'RAW',
        success: function (jobID) {
            console.log("sent to printer with ID: " + jobID);
        },
        error: function (err) {
            console.log(err);
        }
    });
}

app.listen(port, () => console.log(`Listening on port ${port}`));

app.post('/printer', jsonParser, (req, res) => { //Line 9
    const items = req.body.items;
    const cart = req.body.cart;

    items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            printItem(item.name);
        }
    })

    printTotal(cart);

    res.send({message: 'Done'});
});
