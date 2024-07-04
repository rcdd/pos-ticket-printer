require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser')
const {printRequest, getPrintConfig, getPrinterList} = require("./printer");

const app = express();
const jsonParser = bodyParser.json()
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

db.sequelize.sync();
// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

const PORT = process.env.NODE_DOCKER_PORT || 9393;
// set port, listen for requests
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});

// Printer
app.get('/printer/list', [], (req, res) => {
    getPrinterList(res, req);
});

app.post('/printer/print', jsonParser, (req, res) => {
    printRequest(res, req);
});


// DB
const options = require("./db/controllers/options.controller");
app.get("/option/get-printer", options.getPrinter);
app.post("/option/set-printer", options.setPrinter);

const products = require("./db/controllers/products.controller");
app.post("/db/product", products.create);
app.get("/db/products", products.findAll);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.delete);

const records = require("./db/controllers/records.controller");
app.post("/record/add", records.create);
