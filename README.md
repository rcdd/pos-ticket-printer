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
| Terminais     | [http://localhost:9393/terminal](http://localhost:9393/terminal) |

---

## 📱 Modo multiposto (terminais de pedidos)

Funcionalidade **opcional** (requer licença com multiposto): empregados registam pedidos
a partir de telemóveis/tablets ligados à rede Wi-Fi local; o talão do pedido sai na
impressora (com número, ex.: `#042`) e o **pagamento é sempre feito na caixa** — pelo
número do pedido ou fechando a mesa.

Como ativar:

1. Aplicar uma licença com multiposto (gerada com `--features multi`).
2. UI principal → **Configurações → Terminais** → ativar o modo multiposto.
3. Nos telemóveis, ler o **QR code** mostrado nessa página (ou abrir
   `http://<IP-do-PC>:9393/terminal`) e iniciar sessão com um utilizador existente.

Requisitos de rede: PC e telemóveis na mesma rede privada (idealmente um router/AP
dedicado, sem internet), **IP fixo/reservado** para o PC e a regra de firewall da porta
9393 (criada automaticamente pelo `install_script.ps1`).

Notas de operação:

- Sem sessão de caixa aberta, os terminais ficam bloqueados para novos pedidos.
- Anular itens de um pedido já impresso exige aprovação de um administrador e imprime
  um talão de anulação para a cozinha.
- O fecho de sessão avisa se existirem pedidos por pagar (fechá-la mesmo assim anula-os).

### 📵 Modo kiosk nos telemóveis/tablets

O terminal é uma PWA em ecrã inteiro — nos telemóveis usa **"Adicionar ao ecrã
principal"** e abre como uma app (sem barra de URL, portrait bloqueado).

> ⚠️ **"Instala" mas abre como página do browser?** É a regra do Chrome: PWA
> completa exige HTTPS, e o terminal é servido por `http://<IP>` na rede local.
> Soluções: usar o **Fully Kiosk Browser** (não precisa de PWA — abaixo), ou,
> por telemóvel, ativar a flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> com o valor `http://<IP-do-PC>:9393` e reiniciar o Chrome — o "Instalar app"
> passa a funcionar em ecrã inteiro (requer IP fixo/reservado no router).

Para impedir que se saia da app:

- **Android (grátis)** — Definições → Segurança → *Fixar aplicações* (screen
  pinning): fixa a app; sair exige o PIN do dispositivo.
- **iPhone/iPad (grátis)** — Definições → Acessibilidade → *Acesso Guiado*:
  triplo-clique dentro da app bloqueia o dispositivo nela, com código para sair.
- **Dispositivos dedicados (recomendado)** — [Fully Kiosk Browser](https://www.fully-kiosk.com)
  (Android, licença única por dispositivo). Configuração recomendada:
  - **Start URL**: `http://<IP-do-PC>:9393/terminal/`
  - **Kiosk Mode**: ativado, com PIN de saída
  - **Launch on Boot** + **Keep Screen On** (wake lock durante o turno)
  - **Auto Reload on Errors/Idle**: ativado (recupera de quebras de Wi-Fi)
  - **Barras do sistema**: ocultas (fullscreen)
  - **Autofill Forms / Remember Form Data**: **desligado** (dispositivo partilhado;
    autofill de credenciais antigas causa logins "impossíveis" de falhar)
  - Em caso de comportamento estranho após updates: Settings → Clear Cache +
    Clear Cookies + Delete Web Storage → Reload

Desenvolvimento no Mac/Linux: `docker compose up -d mysqldb` + `npm run dev` em `api/` +
`npm run dev` em `terminal/` (proxy para a API). Testes: `npm test` em `api/` e `terminal/`.

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
