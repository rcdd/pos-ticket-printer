# 📘 POS Ticket Print — Installation & Startup Guide

Welcome to the POS Ticket Print system! This project includes:

- 🧠 **Backend** in Node.js (Express)
- 🌐 **Frontend** in React
- 🐳 **Docker**-managed services (UI, Database, phpMyAdmin)
- 🔁 **PM2** for API background process management

---

## ⚙️ 1. First-Time Setup (Run Once)

### 👉 Step 1: Execute

```bat
install.bat
```

This script will:

- Install all required software: Node.js, Docker Desktop, Python, Visual Studio Tools, etc.
- Install project dependencies (`node_modules`) for both the `api/` and `ui/` folders

> ⏳ This may take a few minutes depending on your internet speed and system performance.

---

## 🔁 2. Daily Use / Automatic Startup

To launch the system, run:

```bat
startup.bat
```

This script will:

- Ensure Docker is running (starts Docker Desktop if needed)
- Start the backend API using PM2
- Launch frontend and database containers via Docker Compose
- Open the POS in fullscreen (kiosk) mode in your browser

> 💡 You can place `startup.bat` in your Windows Startup folder to have it run automatically when your PC boots.

---

## 🛠️ Access Points

| Service       | URL                                 |
|---------------|--------------------------------------|
| POS UI        | [http://localhost:8888](http://localhost:8888) |
| API           | [http://localhost:9393](http://localhost:9393) |
| phpMyAdmin    | [http://localhost:8080](http://localhost:8080) |

---

## ❓ Support

For any help or questions, feel free to contact:

- 📧 **Email**: [geral@rubendomingues.pt](mailto:geral@rubendomingues.pt)
- 📞 **Phone**: +351 918 182 831

---
