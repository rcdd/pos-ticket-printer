require("dotenv").config();
const express = require('express');

const app = express();
const cors = require("cors");

var corsOptions = {
    origin: process.env.CLIENT_ORIGIN?.split(',') || ["http://localhost:8888", "http://localhost:3000"],
};

app.use(cors(corsOptions));
// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({extended: true}));

const db = require("./db/models");

db.sequelize.sync({alter: true});
// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

const PORT = process.env.NODE_DOCKER_PORT || 9393;
let PRINTER_NAME = "null";
let HEADERS = {firstLine: null, secondLine: null};
let PRINT_TYPE = "totals"; // totals, tickets, both

const printer = require("./db/controllers/printer/printer.controller");
const options = require("./db/controllers/options.controller");
const products = require("./db/controllers/products.controller");
const invoices = require("./db/controllers/invoices.controller");
const menus = require("./db/controllers/menus.controller");
const zones = require("./db/controllers/zones.controller");

// set port, listen for requests
app.listen(PORT, () => {
    printer.getPrintName().then(res => {
        PRINTER_NAME = res;
    }).catch(() => {
        console.error("No printer defined!");
    });

    options.getHeadersInit().then(res => {
        if (res) {
            HEADERS = res;
        }
    }).catch(() => {
        console.error("No headers defined!");
    });

    options.getPrintType().then(res => {
        if (res) {
            PRINT_TYPE = res;
        } else {
            PRINT_TYPE = "totals"; // default value
        }
    }).catch(() => {
        console.error("No totals value defined!");
    });

    console.log(`Server is running on port ${PORT}.`);
});

// Health check
app.get("/health", (req, res) => {
    res.send("OK");
});

// Printer
app.get('/printer/list', printer.getPrinterList);

app.post('/printer/print', async (req, res) => {
    if (PRINTER_NAME === "null") {
        return res.status(404).send("Printer not defined");
    }

    req.body.printer = PRINTER_NAME;
    req.body.headers = HEADERS;
    req.body.printType = PRINT_TYPE;

    await printer.printRequest(req, res);
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

app.post("/option/set-print-type", (req, res) => {
    options.setTypePrint(req, res);
    PRINT_TYPE = req.body.printType;
});

app.get("/option/get-print-type", options.getPrintType);

app.post("/db/product", products.create);
app.get("/db/products", products.findAll);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.softDelete);
app.post("/db/product/reorder", products.updatePositions);

app.post("/invoice/add", invoices.create);
app.post("/invoice/all", invoices.getAll);
app.post("/invoice/revoke", invoices.revoke);

app.post("/menu/add", menus.create);
app.get("/menus", menus.findAll);
app.put("/menu/:id", menus.update);
app.delete("/menu/:id", menus.delete);

app.post("/zone/add", zones.create);
app.put("/zone/update", zones.update);
app.delete("/zone/:id", zones.softDelete);
app.post("/zone/reorder", zones.updatePositions);
app.get("/zones", zones.findAll);
