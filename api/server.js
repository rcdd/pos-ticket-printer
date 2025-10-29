import express from 'express';
import 'dotenv/config';
import { exec } from 'child_process';

import * as printer  from "./db/controllers/printer/printer.controller.js";
import * as options from "./db/controllers/options.controller.js";
import * as products from "./db/controllers/products.controller.js";
import * as inventory from "./db/controllers/inventory.controller.js";
import * as invoices from "./db/controllers/invoices.controller.js";
import * as menus from "./db/controllers/menus.controller.js";
import * as zones from "./db/controllers/zones.controller.js";
import * as users from "./db/controllers/users.controller.js";
import * as sessions from "./db/controllers/sessions.controller.js";
import * as cashMovements from "./db/controllers/cashMovement.controller.js";
import * as license from "./db/controllers/license.controller.js";
import cors from "cors";
import db from "./db/index.js";
import {authenticate, optionalAuthenticate} from "./middleware/auth.js";
import {enforceLicense, initLicenseState} from "./services/license.service.js";

const app = express();

function extractTableName(model) {
    if (!model) {
        return null;
    }
    if (typeof model.getTableName === "function") {
        const table = model.getTableName();
        if (typeof table === "string") {
            return table;
        }
        if (table && typeof table === "object" && "tableName" in table) {
            return table.tableName;
        }
    }
    if (typeof model.tableName === "string") {
        return model.tableName;
    }
    return null;
}

function normalizeTableName(name) {
    if (name === null || name === undefined) {
        return null;
    }
    return name.toString().toLowerCase();
}

function collectExistingTableNames(rows) {
    if (!Array.isArray(rows)) {
        return new Set();
    }

    const preferredKeys = ["tableName", "table_name", "name"];

    const names = rows.flatMap((row) => {
        if (!row) {
            return [];
        }
        if (typeof row === "string") {
            return [row];
        }
        if (Array.isArray(row)) {
            return row;
        }
        if (typeof row === "object") {
            const matches = preferredKeys
                .map((key) => row[key])
                .filter((value) => typeof value === "string" && value.length > 0);

            if (matches.length > 0) {
                return matches;
            }

            return Object.values(row).filter((value) => typeof value === "string" && value.length > 0);
        }
        return [];
    }).map((value) => normalizeTableName(value))
        .filter(Boolean);

    return new Set(names);
}

async function ensureDatabaseSchema() {
    const syncMode = (process.env.DB_SYNC_ON_BOOT ?? "missing").toLowerCase();
    const skipModes = new Set(["false", "0", "off", "skip"]);

    if (skipModes.has(syncMode)) {
        console.log("[db] Skipping schema sync (DB_SYNC_ON_BOOT=false).");
        return;
    }

    const syncOptions = {};
    if (syncMode === "force") {
        syncOptions.force = true;
    }
    if (syncMode === "alter") {
        syncOptions.alter = true;
    }

    if (["true", "always", "force", "alter"].includes(syncMode)) {
        await db.sequelize.sync(syncOptions);
        console.log(`[db] Schema synchronized (mode=${syncMode}).`);
        return;
    }

    try {
        const queryInterface = db.sequelize.getQueryInterface();
        const tableRows = await queryInterface.showAllTables();
        const existingTables = collectExistingTableNames(tableRows);

        const definedTableMap = new Map();
        Object.values(db.sequelize.models).forEach((model) => {
            const originalName = extractTableName(model);
            const normalizedName = normalizeTableName(originalName);
            if (normalizedName) {
                definedTableMap.set(normalizedName, originalName);
            }
        });

        const missingTables = Array.from(definedTableMap.keys())
            .filter((table) => !existingTables.has(table));

        if (missingTables.length === 0) {
            console.log("[db] Schema check: all tables present.");
            return;
        }

        await db.sequelize.sync();
        const createdTables = missingTables.map((name) => definedTableMap.get(name) ?? name);
        console.log(`[db] Schema synchronized; created tables: ${createdTables.join(", ")}`);
    } catch (schemaError) {
        console.warn("[db] Schema check failed, running sync as fallback.", schemaError);
        await db.sequelize.sync();
        console.log("[db] Schema synchronized (fallback run).");
    }
}

const corsOptions = {
    origin: process.env.CLIENT_ORIGIN?.split(',') || ["http://localhost:8888", "http://127.0.0.1:8888", "http://localhost:3000"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const PORT = process.env.NODE_DOCKER_PORT || 9393;

async function startServer() {
    try {
        await db.sequelize.authenticate();
        console.log('Database connection established.');

        await ensureDatabaseSchema();

        const licenseState = await initLicenseState();
        if (!licenseState.valid) {
            console.warn(`[license] ${licenseState.message}`);
        } else {
            console.log(`[license] Active for tenant ${licenseState.tenant} until ${licenseState.expiresAtIso}`);
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

// License endpoints (public)
app.get("/license/status", license.status);
app.post("/license/apply", license.activate);

// Enforce license for all other requests (skip OPTIONS)
const licenseBypassPaths = new Set([
    "/health",
    "/license/status",
    "/license/apply",
    "/option/virtual-keyboard",
    "/option/onboarding-status",
]);

app.use(async (req, res, next) => {
    if (req.method === 'OPTIONS' || licenseBypassPaths.has(req.path)) {
        return next();
    }
    try {
        await enforceLicense(req, res, next);
    } catch (error) {
        next(error);
    }
});

// Public authentication routes
app.post("/user/login", users.login);
app.post("/user/add", optionalAuthenticate, users.create);

app.get("/option/onboarding-status", options.getOnboardingStatus);
app.get("/option/virtual-keyboard", options.getVirtualKeyboard);

// Require authentication for everything else
app.use(authenticate);

// POS/runtime endpoints (authenticated)
app.get('/printer/list', printer.getPrinterList);
app.get('/printer/usb-devices', printer.getUSBDeviceList);
app.post('/printer/test-direct-connection', printer.testDirectConnection);

app.post('/printer/print-ticket', async (req, res) => {
    const printNameOption = await options.getPrinterVariable();
    const printMethod = await options.getPrintMethodVariable();
    const directPrintConfig = await options.getDirectPrintConfigVariable();

    if (printMethod !== 'direct' && (printNameOption === null || printNameOption === undefined || printNameOption === "")) {
        return res.status(404).send("Printer not defined");
    }

    const dbOpenDrawerOption = await options.getOpenDrawerVariable() ?? false;

    req.body.printer = printNameOption;
    req.body.headers = await options.getHeadersVariable();
    req.body.printType = await options.getPrintTypeVariable();
    req.body.openDrawer = dbOpenDrawerOption ? (req.body.openDrawer || false) : false;
    req.body.printMethod = printMethod;
    req.body.directPrintConfig = directPrintConfig;

    await printer.printTicket(req, res);
});

app.post('/printer/print-session', async (req, res) => {
    const printNameOption = await options.getPrinterVariable();
    const printMethod = await options.getPrintMethodVariable();
    const directPrintConfig = await options.getDirectPrintConfigVariable();

    if (printMethod !== 'direct' && (printNameOption === null || printNameOption === undefined || printNameOption === "")) {
        return res.status(404).send("Printer not defined");
    }

    req.body.printer = printNameOption;
    req.body.headers = await options.getHeadersVariable();
    req.body.printMethod = printMethod;
    req.body.directPrintConfig = directPrintConfig;

    await printer.printSessionSummary(req, res);
});

app.get("/db/products", products.findAll);
app.get("/menus", menus.findAll);
app.get("/zones", zones.findAll);
app.get("/session/active", sessions.getLastActiveSession);
app.post("/invoice/add", invoices.create);

// Authenticated license management
app.get("/license/details", license.statusDetailed);
app.delete("/license", license.remove);

// Users
app.get("/users", users.findAll);
app.get("/user/me", users.me);
app.put("/user", users.update);
app.delete("/user/:id", users.softDelete);
app.post("/user/update-password", users.updatePassword);
app.get("/user/:id", users.findOne);

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
app.post("/option/virtual-keyboard", options.setVirtualKeyboard);
app.get("/option/favorites", options.getFavoritesSettings);
app.post("/option/favorites", options.setFavoritesSettings);

// Print Method & Direct Print Configuration
app.get("/option/get-print-method", options.getPrintMethod);
app.post("/option/set-print-method", options.setPrintMethod);
app.get("/option/get-direct-print-config", options.getDirectPrintConfig);
app.post("/option/set-direct-print-config", options.setDirectPrintConfig);

// Products (management)
app.post("/db/product", products.create);
app.put("/db/product", products.update);
app.delete("/db/product/:id", products.softDelete);
app.post("/db/product/reorder", products.updatePositions);
app.delete("/db/product/zone/:zoneId", products.softDeleteByZone);
app.delete("/db/products", products.softDeleteAllProducts);

// Invoices
app.post("/invoice/all", invoices.getAll);
app.post("/invoice/revoke", invoices.revoke);
app.post("/invoice/session", invoices.getFromSession);
app.get("/reports/top-products", invoices.getTopProducts);

// Menus
app.post("/menu/add", menus.create);
app.put("/menu/:id", menus.update);
app.delete("/menu/:id", menus.deleteMenu);

// Zones
app.post("/zone/add", zones.create);
app.put("/zone/update", zones.update);
app.delete("/zone/:id", zones.softDelete);
app.post("/zone/reorder", zones.updatePositions);
app.delete("/inventory/reset", inventory.resetAll);

// Sessions
app.post("/session/start", sessions.open);
app.post("/session/close/:id", sessions.closeSession);
app.get("/sessions", sessions.findAll);

// Cash Movements
app.post("/cash-movement", cashMovements.create);
app.get("/cash-movements/:sessionId", cashMovements.listBySession);

// System control
app.post("/system/exit", (req, res) => {
    console.log("[System] Exit request received from client");

    res.send({ message: "Shutting down application..." });

    // Give time for response to be sent
    setTimeout(() => {
        console.log("[System] Attempting to close application...");

        if (process.platform === 'win32') {
            // On Windows, kill Edge processes and then exit
            // Kill all Edge kiosk mode processes
            exec('taskkill /F /IM msedge.exe', (error) => {
                if (error) {
                    console.log("[System] Could not kill Edge:", error.message);
                }

                // Exit the Node.js process
                console.log("[System] Exiting Node.js process...");
                process.exit(0);
            });
        } else {
            // On Linux/Mac, just exit Node.js (Edge will stay open)
            console.log("[System] Exiting Node.js process...");
            process.exit(0);
        }
    }, 500);
});
