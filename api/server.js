require("dotenv").config();
const express = require('express');

const app = express();
const cors = require("cors");

var corsOptions = {
    origin: process.env.CLIENT_ORIGIN?.split(',') || ["http://localhost:8888", "http://localhost:3000"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const db = require("./db");

db.sequelize.sync({alter: true}).then(async () => {
    const admin = await db.users.findOne({where: {role: 'admin', isDeleted: 0}});
    if (!admin) {
        const hashedPass = await bcrypt.hash('admin123', 10);
        await db.users.create({
            name: 'Admin',
            username: 'admin',
            password: hashedPass,
            role: 'admin'
        });
        console.log("Default admin user created: username 'admin', password 'admin123'");
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
    });
});

const PORT = process.env.NODE_DOCKER_PORT || 9393;

const printer = require("./db/controllers/printer/printer.controller");
const options = require("./db/controllers/options.controller");
const products = require("./db/controllers/products.controller");
const invoices = require("./db/controllers/invoices.controller");
const menus = require("./db/controllers/menus.controller");
const zones = require("./db/controllers/zones.controller");
const users = require("./db/controllers/users.controller");
const sessions = require("./db/controllers/sessions.controller");
const bcrypt = require("bcrypt");

// Health check
app.get("/health", (req, res) => {
    res.send("OK");
});

// Printer
app.get('/printer/list', printer.getPrinterList);

app.post('/printer/print-ticket', async (req, res) => {
    const printNameOption = await options.getPrinterVariable();
    if (printNameOption === null || printNameOption === undefined || printNameOption === "") {
        return res.status(404).send("Printer not defined");
    }

    const dbOpenDrawerOption = await options.getOpenDrawerVariable() ?? false;

    req.body.printer = printNameOption;
    req.body.headers = await options.getHeadersVariable();
    req.body.printType = await options.getPrintTypeVariable()
    req.body.openDrawer = dbOpenDrawerOption ? (req.body.openDrawer || false) : false;

    await printer.printTicketRequest(req, res);
});

app.post('/printer/print-session', async (req, res) => {
    const printNameOption = await options.getPrinterVariable();
    if (printNameOption === null || printNameOption === undefined || printNameOption === "") {
        return res.status(404).send("Printer not defined");
    }

    req.body.printer = printNameOption;
    req.body.headers = await options.getHeadersVariable();

    await printer.printSessionSummary(req, res);
});

// Options
app.get("/option/get-printer", options.getPrinter);

app.post("/option/set-printer", async (req, res) => {
    await options.setPrinter(req, res)
});

app.post("/option/set-first-header", (req, res) => {
    options.setHeaderFirstLine(req, res);
});
app.post("/option/set-second-header", (req, res) => {
    options.setHeaderSecondLine(req, res);
});
app.get("/option/get-header", options.getHeaders);

app.post("/option/set-print-type", (req, res) => {
    options.setTypePrint(req, res);
});

app.get("/option/get-print-type", options.getPrintType);

app.post("/option/set-open-drawer", (req, res) => {
    options.setOpenDrawer(req, res);
});

app.get("/option/get-open-drawer", options.getOpenDrawer);

// Products
app.post("/db/product", products.create);
app.get("/db/products", products.findAll);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.softDelete);
app.post("/db/product/reorder", products.updatePositions);

// Invoices
app.post("/invoice/add", invoices.create);
app.post("/invoice/all", invoices.getAll);
app.post("/invoice/revoke", invoices.revoke);
app.post("/invoice/session", invoices.getFromSession);

// Menus
app.post("/menu/add", menus.create);
app.get("/menus", menus.findAll);
app.put("/menu/:id", menus.update);
app.delete("/menu/:id", menus.delete);

// Zones
app.post("/zone/add", zones.create);
app.put("/zone/update", zones.update);
app.delete("/zone/:id", zones.softDelete);
app.post("/zone/reorder", zones.updatePositions);
app.get("/zones", zones.findAll);

// Users
app.post("/user/add", users.create);
app.get("/users", users.findAll);
app.get("/user/:id", users.findOne);
app.put("/user", users.update);
app.delete("/user/:id", users.softDelete);
app.post("/user/login", users.login);
app.post("/user/update-password", users.updatePassword);

// Sessions
app.post("/session/start", sessions.open);
app.post("/session/close/:id", sessions.closeSession);
app.get("/sessions", sessions.findAll);
app.get("/session/active", sessions.getLastActiveSession);