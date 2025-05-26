# 🧾 POS Ticket Printer — Setup & Usage Guide

A lightweight POS (Point of Sale) system with local ticket printing, built with:

- 🧠 Backend: Node.js + Express (managed with PM2)
- 🌐 Frontend: React (served via Docker)
- 🐳 MySQL + phpMyAdmin: Dockerized
- ⚙️ 100% offline-capable & ready for kiosk use

---

## ⚙️ 1. First-time installation (required once per machine)

After downloading the `.zip` or cloning the repository:

```bat
install.bat
```

This will:

- Install required dependencies (Node.js, Docker, Python, VS Build Tools)
- Install backend dependencies (`api/node_modules`)
- Remove any previous PM2 process (`api-pos`)
- Build and launch Docker containers (UI + database)

> 📌 This script should always be used after a **fresh setup** or **version update**.

---

## 🚀 2. Daily usage / Startup routine

To launch the POS system:

```bat
startup.bat
```

This will:

- Ensure Docker is running (starts Docker Desktop if needed)
- Ensure the Express API is running via PM2
- Start existing Docker containers (UI + database)
- Open the POS interface in kiosk mode

> 💡 You can add `startup.bat` to your Windows Startup folder or use Task Scheduler with a short delay.

---

## 🔄 3. Updating the application

To update to a newer version:

1. Download the new `.zip` from GitHub and extract it over the old one
2. Run:

```bat
install.bat
```

This will:

- Remove the previous `api-pos` process (PM2)
- Install updated backend dependencies if needed
- Rebuild Docker images with new UI code and settings

No need to uninstall or manually clean anything!

---

## 🛠️ Access Points

| Service        | URL                                |
|----------------|-------------------------------------|
| POS UI         | [http://localhost:8888](http://localhost:8888) |
| Express API    | [http://localhost:9393](http://localhost:9393) |
| phpMyAdmin     | [http://localhost:8080](http://localhost:8080) |

---

## 📎 Shortcuts

| File             | Purpose                              |
|------------------|--------------------------------------|
| `install.bat`    | Prepares environment and containers  |
| `startup.bat`    | Starts everything day-to-day         |
| `check-pm2.js`   | Manages PM2 API process              |
| `ecosystem.config.js` | PM2 configuration for Express   |

---

## 📧 Support

For help or questions, contact:

- Email: [geral@rubendomingues.pt](mailto:geral@rubendomingues.pt)
- Phone: +351 918 182 831

---
