import express from 'express';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as printer  from "./db/controllers/printer/printer.controller.js";
import * as options from "./db/controllers/options.controller.js";
import * as products from "./db/controllers/products.controller.js";
import * as invoices from "./db/controllers/invoices.controller.js";
import * as menus from "./db/controllers/menus.controller.js";
import * as zones from "./db/controllers/zones.controller.js";
import * as users from "./db/controllers/users.controller.js";
import * as sessions from "./db/controllers/sessions.controller.js";
import bcrypt from "bcrypt";
import cors from "cors";
import db from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

var corsOptions = {
    origin: process.env.CLIENT_ORIGIN?.split(',') || ["http://localhost:8888", "http://localhost:3000"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

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

    await printer.printTicket(req, res);
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
app.delete("/menu/:id", menus.deleteMenu);

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
