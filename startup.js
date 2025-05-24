const { execSync, spawn } = require("child_process");
require("dotenv").config();

const API_PORT = process.env.API_PORT || 9393;

// Check if npm is installed
function checkNpmInstalled() {
    try {
        console.log("Checking for npm...");
        execSync("npm --version", { stdio: "inherit" });
        console.log("npm is installed.");
    } catch (error) {
        console.error("npm is not installed. Please install Node.js from https://nodejs.org/");
        process.exit(1);
    }
}

// Check if Docker is running
function checkDockerRunning() {
    try {
        execSync("docker info", { stdio: "ignore" });
        console.log("Docker is running.");
    } catch (error) {
        console.error("Docker is not running or not installed.");
        process.exit(1);
    }
}

// Start Docker Compose services
function startDockerCompose() {
    return new Promise((resolve, reject) => {
        console.log("Starting Docker services...");
        const dockerCompose = spawn("docker-compose", ["up", "-d"], {
            shell: true,
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

// Wait for API to become available
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

// Main process
async function main() {
    try {
        checkNpmInstalled();
        checkDockerRunning();
        await startDockerCompose();

        console.log("Waiting for Express API to initialize...");
        await waitForService(`http://localhost:${API_PORT}/health`);

        console.log("✅ All services are running!");
    } catch (error) {
        console.error("❌ Error during initialization:", error.message || error);
        process.exit(1);
    }
}

main();
