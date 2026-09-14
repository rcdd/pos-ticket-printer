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

| Service       | URL                                                              |
|---------------|------------------------------------------------------------------|
| POS UI        | [http://localhost:3000](http://localhost:3000)                   |
| Express API   | [http://localhost:9393/api](http://localhost:9393/api)           |
| phpMyAdmin    | [http://localhost:8080](http://localhost:8080)                   |
| Terminals     | [http://localhost:9393/terminal](http://localhost:9393/terminal) |

---

## 📱 Multi-terminal mode (ordering terminals)

**Optional** feature (requires a license with multi-terminal): waiters place orders
from phones/tablets connected to the local Wi-Fi; the order ticket comes out on the
printer (with a number, e.g. `#042`) and **payment always happens at the register** —
by order number or by closing the table.

How to enable:

1. Apply a license that includes multi-terminal (generated with `--features multi`).
2. Main UI → **Configurações → Terminais** → enable multi-terminal mode.
3. On the phones, scan the **QR code** shown on that page (or open
   `http://<PC-IP>:9393/terminal`) and sign in with an existing user.

Network requirements: PC and phones on the same private network (ideally a dedicated
router/AP, no internet), a **static/reserved IP** for the PC, and the port 9393
firewall rule (created automatically by `install_script.ps1`).

Operational notes:

- Without an open register session, terminals are blocked from placing new orders.
- Voiding items of an already-printed order requires admin approval and prints a
  void ticket for the kitchen.
- Closing the session warns about unpaid orders (closing anyway cancels them).

### 📵 Kiosk mode on phones/tablets

The terminal is a fullscreen PWA — on phones use **"Add to Home Screen"** and it
opens like an app (no URL bar, portrait locked).

> ⚠️ **"Installs" but opens as a browser page?** That's Chrome's rule: a full PWA
> requires HTTPS, and the terminal is served over `http://<IP>` on the LAN.
> Workarounds: use the **Fully Kiosk Browser** (no PWA needed — below), or,
> per phone, enable the `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> flag with the value `http://<PC-IP>:9393` and restart Chrome — "Install app"
> then works fullscreen (requires a static/reserved IP on the router).

To keep users from leaving the app:

- **Android (free)** — Settings → Security → *App pinning* (screen pinning):
  pin the app; leaving requires the device PIN.
- **iPhone/iPad (free)** — Settings → Accessibility → *Guided Access*:
  triple-click inside the app locks the device to it, with a passcode to exit.
- **Dedicated devices (recommended)** — [Fully Kiosk Browser](https://www.fully-kiosk.com)
  (Android, one-time license per device). Recommended configuration:
  - **Start URL**: `http://<PC-IP>:9393/terminal/`
  - **Kiosk Mode**: enabled, with an exit PIN
  - **Launch on Boot** + **Keep Screen On** (wake lock during the shift)
  - **Auto Reload on Errors/Idle**: enabled (recovers from Wi-Fi drops)
  - **System bars**: hidden (fullscreen)
  - **Autofill Forms / Remember Form Data**: **disabled** (shared device; stale
    autofilled credentials cause logins that "impossibly" keep failing)
  - If things act strangely after updates: Settings → Clear Cache +
    Clear Cookies + Delete Web Storage → Reload

Development on Mac/Linux: `docker compose up -d mysqldb` + `npm run dev` in `api/` +
`npm run dev` in `terminal/` (proxies to the API). Tests: `npm test` in `api/` and `terminal/`.

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
