# 🎟️ POS Ticket System — Setup & Usage Guide

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-blue?logo=mysql)](https://www.mysql.com/)
[![PHP](https://img.shields.io/badge/PHP-8.x-purple?logo=php)](https://www.php.net/)
[![PM2](https://img.shields.io/badge/PM2-Process%20Manager-orange)](https://pm2.keymetrics.io/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

A lightweight **Point of Sale (POS)** system, designed to run **100% offline**, with automatic startup and kiosk-ready interface.

Includes:
- ⚡ **Backend**: Node.js + Express (managed via PM2)
- 🖥️ **Frontend**: React (build served via PM2)
- 🗄️ **Database**: MySQL
- 🛠️ **Administration**: phpMyAdmin (port 8080)
- 💻 **Interface**: automatic **kiosk mode** in Microsoft Edge
- 🖼️ **Experience**: clean splash screen, no console window visible

---

## ⚙️ 1. First-time installation (per machine)

1. Download the `.zip` release or clone the repository.
2. Run:

```bat
install.bat
```

This script will:
- Install required dependencies:
    - Node.js (via Chocolatey)
    - PHP (for phpMyAdmin)
    - MySQL (Windows service)
- Automatically configure:
    - Initial database (`pos_ticket`)
    - User + password (randomly generated)
    - API `.env` file
- Install backend & frontend dependencies
- Register and prepare services in PM2
- Create a **Desktop shortcut** (`POS Ticket.lnk`) for quick startup

> 📌 First-time installation may take several minutes.  
> Always run `install.bat` again after a **fresh setup** or **version update**.

---

## 🚀 2. Daily usage

To start the POS system, simply double-click the desktop shortcut:

```
POS Ticket.lnk
```

Or run manually:

```bat
startup.bat
```

This will:
- Ensure PM2 daemon is running
- Start the services:
    - **API** (Node.js/Express)
    - **Frontend** (React build via `pm2 serve`)
    - **phpMyAdmin** (PHP built-in server on port 8080)
- Display a **splash screen** instead of a console window
- Launch the **POS UI in kiosk mode** in Microsoft Edge

> 🖥️ The user never sees a console.  
> In case of errors, the splash closes and a diagnostic PowerShell window opens automatically with logs.

---

## 🔄 3. Updating the system

To update to a new version:

1. Replace the old folder with the new `.zip` contents (or pull latest from Git).
2. Run:

```bat
install.bat
```

This will:
- Update dependencies if required
- Reapply DB and `.env` configuration
- Rebuild API/UI if needed
- Keep shortcuts and data intact

No need to uninstall or manually clean up.

---

## 🛠️ Access points

| Service       | URL                                                    |
|---------------|--------------------------------------------------------|
| POS UI        | [http://localhost:3000](http://localhost:3000)         |
| Express API   | [http://localhost:9393/api](http://localhost:9393/api) |
| phpMyAdmin    | [http://localhost:8080](http://localhost:8080)         |

---

## 📎 Important files

| File / Script         | Purpose                                 |
|------------------------|-----------------------------------------|
| `install.bat`          | Prepares environment & dependencies     |
| `install_script.ps1`   | Full installation logic (PowerShell)    |
| `startup.ps1`          | Launches API, UI, phpMyAdmin, Edge      |
| `startup.launcher.vbs` | Hidden launcher (suppresses console)    |
| `logs/startup-*.log`   | Startup logs (for debugging)            |

---

## 📧 Support

- 📩 Email: [geral@rubendomingues.pt](mailto:geral@rubendomingues.pt)
- 📞 Phone: +351 918 182 831

---
