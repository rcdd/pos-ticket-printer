require("dotenv").config();
const express = require('express');

const app = express();
const cors = require("cors");

var corsOptions = {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000"
};

app.use(cors(corsOptions));
// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({extended: true}));

const db = require("./db/models");

db.sequelize.sync({ alter: true });
// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

const PORT = process.env.NODE_DOCKER_PORT || 9393;
let PRINTER_NAME = "null";
let HEADERS = {firstLine: null, secondLine: null};

const printer = require("./db/controllers/printer/printer.controller");
const options = require("./db/controllers/options.controller");
const products = require("./db/controllers/products.controller");
const records = require("./db/controllers/records.controller");

// set port, listen for requests
app.listen(PORT, () => {
    printer.getPrintName().then(res => {
        console.log(res);
        PRINTER_NAME = res;
    }).catch(e => {
        console.error("No printer defined!");
    });

    options.getHeadersInit().then(res => {
        console.log(res);
        if(res){
            HEADERS = res;
        }
    }).catch(e => {
       console.error("No headers defined!");
    });

    console.log(`Server is running on port ${PORT}.`);
});

// Printer
app.get('/printer/list', printer.getPrinterList);

app.post('/printer/print', (req, res) => {
    req.body.printer = PRINTER_NAME;
    req.body.headers = HEADERS;
    printer.printRequest(req, res);
});

// DB
app.get("/option/get-printer", options.getPrinter);
app.post("/option/set-printer", (req, res) => {
    options.setPrinter(req, res)
    PRINTER_NAME = req.body.name;
});

app.post("/option/set-first-header", (req, res) => {
    options.setHeaderFirstLine(req, res);
    HEADERS.firstLine = req.body.firstLine;
});
app.post("/option/set-second-header", (req, res) => {
    options.setHeaderSecondLine(req, res);
    HEADERS.secondLine = req.body.secondLine;
});
app.get("/option/get-header", options.getHeaders);

app.post("/db/product", products.create);
app.get("/db/products", products.findAll);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.delete);

app.post("/record/add", records.create);