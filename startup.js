const fs = require("fs");
const { execSync, spawn } = require("child_process");
const path = require("path");
require("dotenv").config();

const API_PORT = process.env.API_PORT || 9393;
const UI_PORT = process.env.UI_PORT || 3000;

function checkNpmInstalled() {
    try {
        console.log("Checking for npm...");
        execSync("npm --version", { stdio: "inherit" });
        console.log("npm is installed.");
    } catch (error) {
        console.error(
            "npm is not installed. Please install Node.js (which includes npm) from https://nodejs.org/."
        );
        process.exit(1); // Exit the script since npm is required
    }
}

// Check if Docker is running
function checkDockerRunning() {
    return new Promise((resolve, reject) => {
        execSync("docker info", { stdio: "ignore" });
        console.log("Docker is running.");
        resolve();
    });
}

// Start Docker Compose services
function startDockerCompose() {
    return new Promise((resolve, reject) => {
        console.log("Starting Docker services...");
        const dockerCompose = spawn("docker-compose", ["up", "-d"], {
            shell: true, // Required for Windows
            stdio: "inherit",
        });

        dockerCompose.on("close", (code) => {
            if (code !== 0) {
                console.error(`Docker Compose failed with code ${code}.`);
                return reject(new Error("Docker Compose failed."));
            }
            console.log("Docker services are up and running.");
            resolve();
        });
    });
}

// Start Express API
function startExpressAPI() {
    const apiPath = path.join(__dirname, "api");
    const nodeModulesPath = path.join(apiPath, "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
        console.log("Node modules not found for Express API. Installing dependencies...");
        try {
            execSync("npm install", { cwd: apiPath, stdio: "inherit" });
        } catch (error) {
            console.error("Failed to install dependencies for Express API:", error);
            throw new Error("Failed to prepare Express API.");
        }
    }

    console.log("Starting Express API...");
    const apiProcess = spawn("node", [path.join(apiPath, "server.js")], {
        shell: true,
        stdio: "inherit", // Show server logs in real-time
    });

    apiProcess.on("error", (err) => {
        console.error("Failed to start Express API:", err);
        throw new Error("Failed to start Express API.");
    });

    apiProcess.on("close", (code) => {
        if (code !== 0) {
            console.error(`Express API exited with code ${code}`);
        }
    });
}

// Check and start React UI
function startReactInProduction(buildPath) {
    console.log("Starting React UI in production mode...");
    const productionServer = spawn("npx", ["serve", "-s", buildPath, "-l", UI_PORT], {
        shell: true,
        stdio: "inherit",
    });

    productionServer.on("error", (err) => {
        console.error("Failed to start React UI in production mode:", err);
        throw new Error("Failed to start React UI in production mode.");
    });

    productionServer.on("close", (code) => {
        if (code !== 0) {
            console.error(`React UI production server exited with code ${code}`);
        }
    });
}

function startReactInDevelopment(uiPath) {
    console.log("Starting React UI in development mode...");
    const devServer = spawn("npm", ["start"], {
        cwd: uiPath,
        shell: true,
        stdio: "inherit",
    });

    devServer.on("error", (err) => {
        console.error("Failed to start React UI in development mode:", err);
        throw new Error("Failed to start React UI in development mode.");
    });

    devServer.on("close", (code) => {
        if (code !== 0) {
            console.error(`React UI development server exited with code ${code}`);
        }
    });
}

function startReactUI() {
    const uiPath = path.join(__dirname, "ui");
    const buildPath = path.join(uiPath, "build");

    if (fs.existsSync(buildPath)) {
        startReactInProduction(buildPath);
    } else {
        console.log("Build folder not found. Preparing React UI...");
        try {
            execSync("npm install", { cwd: uiPath, stdio: "inherit" });
            execSync("npm run build", { cwd: uiPath, stdio: "inherit" });
            startReactInDevelopment(uiPath);
        } catch (error) {
            console.error("Failed to prepare React UI:", error);
            throw new Error("Failed to prepare React UI.");
        }
    }
}

// Poll for service readiness
async function waitForService(url, maxRetries = 10, delay = 3000) {
    const axios = require("axios");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await axios.get(url);
            console.log(`${url} is ready.`);
            return;
        } catch (error) {
            console.log(`Waiting for ${url}... (Attempt ${attempt}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error(`Service at ${url} is not ready after ${maxRetries} attempts.`);
}

async function main() {
    try {
        checkNpmInstalled();
        await checkDockerRunning();
        await startDockerCompose();

        startExpressAPI();

        console.log("Waiting for Express API to initialize...");
        await waitForService(`http://localhost:${API_PORT}/health`);

        startReactUI();

        console.log("All services are running!");
    } catch (error) {
        console.error("Error during initialization:", error.message || error);
        process.exit(1);
    }
}

main();
