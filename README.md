# 🎟️ POS Ticket System — Setup & Usage Guide

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-blue?logo=mysql)](https://www.mysql.com/)
[![PHP](https://img.shields.io/badge/PHP-8.x-purple?logo=php)](https://www.php.net/)
[![PM2](https://img.shields.io/badge/PM2-Process%20Manager-orange)](https://pm2.keymetrics.io/)

A lightweight **Point of Sale (POS)** system, designed to run **100% offline**, with automatic startup and kiosk-ready interface.

Includes:
- ⚡ **Backend**: Node.js + Express (managed via PM2)
- 🖥️ **Frontend**: React (build served via PM2)
- 🗄️ **Database**: MySQL
- 🛠️ **Administration**: phpMyAdmin (port 8080)
- 💻 **Interface**: automatic **kiosk mode** (Microsoft Edge, falls back to Chrome)
- 🖼️ **Experience**: branded splash screen showing the running version, no console window visible

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

> 📌 First-time installation may take several minutes. To update an existing installation
> afterwards, use `update.bat` instead (see §3) — don't re-run `install.bat`.

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

`install.bat` is only for a **brand-new machine**. To update an existing installation, run:

```bat
update.bat
```

This pulls the latest code (Git or the release `.zip`), then for each of **API**, **UI** and **Terminal**
asks S/N whether to rebuild it, and:
- Syncs files, preserving `api/.env` and any local data (never overwritten)
- Reinstalls dependencies with `npm ci` (uses the committed `package-lock.json`, so every machine
  gets the exact dependency set that was tested upstream — never a fresh, untested resolution)
- Rebuilds the UI and/or Terminal only for the components you confirmed
- Keeps the desktop shortcut and refreshes its icon if it changed (no reboot needed)

No need to uninstall or manually clean up. Restart via the desktop shortcut afterwards.

---

## 🛠️ Access points

| Service       | URL                                                              |
|---------------|------------------------------------------------------------------|
| POS UI        | [http://localhost:3000](http://localhost:3000)                   |
| Express API   | [http://localhost:9393](http://localhost:9393)                   |
| phpMyAdmin    | [http://localhost:8080](http://localhost:8080)                   |
| Terminals     | [http://localhost:9393/terminal](http://localhost:9393/terminal) (`/` also redirects here) |

---

## ✨ Feature highlights (v3.0.4)

Beyond basic ticket printing, the system now covers:

- **Printing, per printer model** (Configurações → Impressora → Definições avançadas): header
  position, cut mode, feed lines, explicit columns-per-line, character encoding, drawer pin, small
  font — because thermal printers vary a lot in what they support. "Testar impressão" and
  "Testar gaveta" buttons validate a change without a real sale.
- **Ticket layout** (Configurações → Talões): independent text size per element (product name,
  totals, table/order number, kitchen notes, destination line), with a live preview and a
  "Imprimir exemplo" per ticket type.
- **Orders (register, Pedidos page)**: **Mover** an order to another table/new group/standalone
  (prints a correction ticket for the kitchen); **Modificar** lets you set what an order should end
  up with ("3 coffees → 2") instead of thinking in cancellations; **Anular** cancels the whole
  order. Every action is audited.
- **Kitchen tickets split by product zone** (bar/kitchen), each with a destination line, toggle in
  Configurações → Terminais.
- **Split payments**: "Dividir conta" splits the bill across N people, each with its own amount and
  payment method (cash/MBWay/card); change is computed only over the cash portion, with a final
  summary showing it.
- **Live terminal sync**: product/price/zone edits at the register reach connected phones instantly,
  without losing an order in progress.
- **Session reports**: historical values use the price at sale time (changing prices later doesn't
  rewrite old reports); CSV export follows whatever filters/columns are active on screen; test or
  training sessions can be marked at close and are hidden from reports by default.
- **Kiosk app control**: a working "Fechar aplicação" button in kiosk mode, and the desktop
  shortcut refuses to open a second instance if double-clicked while already starting.

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

> ⚠️ **"Installs" but opens as a browser page? / "Não é possível instalar esta app"?**
> That's Chrome's rule: installing a full PWA requires a secure context (HTTPS or
> `localhost`), and the terminal is served over `http://<IP>` on the LAN — so the
> Install option is refused and only "Create shortcut" works.
> Workarounds: use the **Fully Kiosk Browser** (no PWA needed — below), or,
> per device, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
> put `http://<PC-IP>:9393` in the text box, set the flag to **Enabled** and
> restart Chrome — "Install app" then works fullscreen (requires a
> static/reserved IP on the router, or the flag breaks when the IP changes).

To keep users from leaving the app:

- **Android (free)** — Settings → Security → *App pinning* (screen pinning):
  pin the app; leaving requires the device PIN.
- **iPhone/iPad (free)** — Settings → Accessibility → *Guided Access*:
  triple-click inside the app locks the device to it, with a passcode to exit.
- **Dedicated devices (recommended)** — [Fully Kiosk Browser](https://www.fully-kiosk.com)
  (Android, one-time license per device). Recommended configuration:
  - **Start URL**: `http://<PC-IP>:9393` (the root redirects to the terminal)
  - **Kiosk Mode**: enabled, with an exit PIN
  - **Launch on Boot** + **Keep Screen On** (wake lock during the shift)
  - **Auto Reload on Errors/Idle**: enabled (recovers from Wi-Fi drops)
  - **System bars**: hidden (fullscreen)
  - **Autofill Forms / Remember Form Data**: **disabled** (shared device; stale
    autofilled credentials cause logins that "impossibly" keep failing)
  - If things act strangely after updates: Settings → Clear Cache +
    Clear Cookies + Delete Web Storage → Reload

Development on Mac/Linux: `docker compose up -d mysqldb` + `npm run dev` in `api/` +
`npm run dev` in `terminal/` (proxies to the API). Tests: `npm test` in `api/` and `terminal/`;
`CI=true npx react-scripts test --watchAll=false` in `ui/`.

---

## 📎 Important files

| File / Script         | Purpose                                 |
|------------------------|-----------------------------------------|
| `install.bat`          | First-time setup on a new machine (Chocolatey, DB, `.env`) |
| `install_script.ps1`   | Full installation logic (PowerShell)    |
| `update.bat`           | Updates an existing installation (see §3) |
| `update_script.ps1`    | Update logic — sync, `npm ci`, per-component rebuild (PowerShell) |
| `startup.ps1`          | Launches API, UI, phpMyAdmin, kiosk browser (single-instance guarded) |
| `startup.launcher.vbs` | Hidden launcher (suppresses console)    |
| `logs/startup-*.log`   | Startup logs (for debugging)            |

---

## 📄 License

This is proprietary software — there is no open-source license, and no permission is granted to
reuse, redistribute, or resell it. The source is public so technical users can read it, run it for
their own understanding, and open issues or pull requests; contributions are welcome, but at the
maintainer's sole discretion. Commercial use, hosting, or redistribution requires a separate
agreement — get in touch (below).

## 📧 Support

- 📩 Email: [geral@rubendomingues.pt](mailto:geral@rubendomingues.pt)
- 📞 Phone: +351 918 182 831

---
