import express from 'express';
import 'dotenv/config';

import * as printer  from "./db/controllers/printer/printer.controller.js";
import * as options from "./db/controllers/options.controller.js";
import * as products from "./db/controllers/products.controller.js";
import * as invoices from "./db/controllers/invoices.controller.js";
import * as menus from "./db/controllers/menus.controller.js";
import * as zones from "./db/controllers/zones.controller.js";
import * as users from "./db/controllers/users.controller.js";
import * as sessions from "./db/controllers/sessions.controller.js";
import * as cashMovements from "./db/controllers/cashMovement.controller.js";
import cors from "cors";
import db from "./db/index.js";
import {authenticate, optionalAuthenticate} from "./middleware/auth.js";

const app = express();

const corsOptions = {
    origin: process.env.CLIENT_ORIGIN?.split(',') || ["http://localhost:8888", "http://localhost:3000"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const PORT = process.env.NODE_DOCKER_PORT || 9393;

async function startServer() {
    try {
        await db.sequelize.authenticate();
        console.log('Database connection established.');

        if (process.env.DB_SYNC_ON_BOOT === 'true') {
            await db.sequelize.sync();
            console.log('Database synchronized (DB_SYNC_ON_BOOT=true).');
        }
    } catch (err) {
        console.error('Unable to connect to the database:', err);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
    });
}

startServer();

// Health check
app.get("/health", (req, res) => {
    res.send("OK");
});

// Public authentication routes
app.post("/user/login", users.login);
app.post("/user/add", optionalAuthenticate, users.create);

// Public POS/runtime endpoints
app.get('/printer/list', printer.getPrinterList);

app.post('/printer/print-ticket', async (req, res) => {
    const printNameOption = await options.getPrinterVariable();
    if (printNameOption === null || printNameOption === undefined || printNameOption === "") {
        return res.status(404).send("Printer not defined");
    }

    const dbOpenDrawerOption = await options.getOpenDrawerVariable() ?? false;

    req.body.printer = printNameOption;
    req.body.headers = await options.getHeadersVariable();
    req.body.printType = await options.getPrintTypeVariable();
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

app.get("/db/products", products.findAll);
app.get("/menus", menus.findAll);
app.get("/zones", zones.findAll);
app.get("/session/active", sessions.getLastActiveSession);
app.post("/invoice/add", invoices.create);
app.get("/option/onboarding-status", options.getOnboardingStatus);

// Require authentication for everything else
app.use(authenticate);

// Users
app.get("/users", users.findAll);
app.get("/user/:id", users.findOne);
app.put("/user", users.update);
app.delete("/user/:id", users.softDelete);
app.post("/user/update-password", users.updatePassword);
app.get("/user/me", users.me);

// Options
app.get("/option/get-printer", options.getPrinter);

app.post("/option/set-printer", async (req, res) => {
    await options.setPrinter(req, res);
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

// Products (management)
app.post("/db/product", products.create);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.softDelete);
app.post("/db/product/reorder", products.updatePositions);

// Invoices
app.post("/invoice/all", invoices.getAll);
app.post("/invoice/revoke", invoices.revoke);
app.post("/invoice/session", invoices.getFromSession);

// Menus
app.post("/menu/add", menus.create);
app.put("/menu/:id", menus.update);
app.delete("/menu/:id", menus.deleteMenu);

// Zones
app.post("/zone/add", zones.create);
app.put("/zone/update", zones.update);
app.delete("/zone/:id", zones.softDelete);
app.post("/zone/reorder", zones.updatePositions);

// Sessions
app.post("/session/start", sessions.open);
app.post("/session/close/:id", sessions.closeSession);
app.get("/sessions", sessions.findAll);

// Cash Movements
app.post("/cash-movement", cashMovements.create);
app.get("/cash-movements/:sessionId", cashMovements.listBySession);
