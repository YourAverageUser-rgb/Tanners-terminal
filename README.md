# Xbox PC — Tanner's Edition

A full Windows app that turns your PC into an Xbox-style console experience. Built for people who jumped from Xbox to PC and still want the dashboard, friends, parties, library, captures, and one-button shortcuts to every Xbox tool that ships with Windows — without re-buying a console.

It is **not** a Microsoft product. It's a fan launcher that wraps the real Xbox app, Game Bar, Game Pass, Microsoft Store, and your installed games into a single console-style dashboard with full Xbox controller support.

---

## What it does

- **Real Xbox-style dashboard** (Series X|S look) with Home, Library, Store, Game Pass, Cloud Gaming, Friends, Parties, Messages, Achievements, Captures, Settings, and an Xbox Tools page.
- **Real game scanning**: finds installed games from `C:\XboxGames` (Xbox app), `Program Files\WindowsApps` (UWP / Game Pass UWP), Steam (all libraries via `libraryfolders.vdf`), and Epic Games Launcher (manifests).
- **Real game launching**: spawns `.exe` files for Xbox app installs, hands off to `steam://run/<appid>` for Steam, `com.epicgames.launcher://` for Epic, and `shell:appsFolder\<AUMID>` for UWP / Game Pass.
- **Real Xbox tool shortcuts**: open the Xbox app, Game Bar, Microsoft Store, Game Pass library, Captures folder, Screenshots folder, Game Bar settings, Game Mode settings, Xbox account, Xbox Friends page, Game Pass Quests, Redeem code dialog — all one click.
- **Boots with Windows** via `app.setLoginItemSettings({ openAtLogin: true })`, on by default. Toggle from the tray icon or Settings.
- **System tray** with Open / Screenshot / Scan / Tool shortcuts / Boot toggle / Quit.
- **Global hotkey**: `Ctrl+Shift+X` brings the dashboard to the front from anywhere in Windows.
- **Live PC stats**: CPU%, RAM%, uptime, GPU model — visible in the Xbox Tools page.
- **Native screenshots**: capture the whole desktop into `Pictures\Xbox PC Captures`.
- **Native Windows notifications** for downloads, achievements, party joins.
- **Frameless Xbox-themed window** with custom min/max/close, or fullscreen for true console feel.
- **Xbox controller native support** via the Gamepad API — buttons map exactly like a console (A select, B back, X context, Y info, Xbox button = guide, LB/RB tabs, View/Menu). Vibration test included.
- **Keyboard mirror** of every controller button for keyboard-only PCs.
- **Four dashboard versions**: Series X|S, Xbox One, Xbox 360 (Blade/NXE), Original Xbox. Switch live.
- **Party + messaging UI** (local for now — see the Xbox Live API hooks in `docs/autostart.html` for wiring real friends/party/voice).

---

## Install (end users)

Once a release is published, grab the installer from the Releases tab:

- **`Xbox-PC-1.0.0-x64.exe`** — full installer (creates Start menu + desktop shortcut, registers autostart).
- **`Xbox-PC-portable.exe`** — single executable, no install.

Run it. The Xbox dashboard opens fullscreen on next boot.

To turn off autostart later: right-click the green X tray icon → **Boot on Windows Login** → uncheck.

---

## Run from source

```sh
git clone https://github.com/YourAverageUser-rgb/Tanners-terminal.git
cd Tanners-terminal
npm install
npm start
```

For a windowed dev run with DevTools:

```sh
npm run dev
```

---

## Build the Windows installer

```sh
npm run build:win
```

Outputs to `dist/`:
- `Xbox PC-1.0.0-x64.exe` (NSIS installer)
- `Xbox-PC-portable.exe` (portable)

---

## File layout

```
package.json           — Electron app config + electron-builder targets
electron/
  main.js              — main process (window, tray, autostart, IPC)
  preload.js           — exposes window.XboxNative to renderer
  scanner.js           — real installed-games scanner
  launcher.js          — real launchers + Xbox tool shortcuts
  icon.png             — app + tray icon
docs/
  xbox.html            — main dashboard
  xbox.css             — themes (Series X|S / Xbox One / 360 / Original)
  xbox.js              — dashboard logic, library, downloads, party, messages
  xbox-data.js         — mock data (used as fallback / Game Pass / Cloud sections)
  xbox-input.js        — gamepad + keyboard input layer
  autostart.html       — browser-mode autostart guide
  index.html           — original terminal + launcher buttons
```

---

## Controller mapping

| Action | Controller | Keyboard |
| --- | --- | --- |
| Navigate | D-Pad / Left Stick | Arrows / WASD |
| Select / Play | A | Enter |
| Back | B | Esc / Backspace |
| Context menu | X | Q |
| Quick info | Y | E |
| Guide | Xbox button | Space |
| Captures | View | Tab |
| Menu | Menu | Shift+Tab |
| Switch tab | LB / RB | 1 / 2 |
| Bring dashboard forward | — | Ctrl+Shift+X (anywhere in Windows) |

---

## Privacy + scope

- No telemetry. No network calls from the desktop app unless you click a Xbox.com / Microsoft Store link.
- Settings, gamertag, library, party, and messages all persist to `localStorage` inside the Electron user data directory.
- The scanner reads `C:\XboxGames`, `Program Files\WindowsApps`, Steam library folders, and Epic manifests **read-only**. Folders that are locked (UWP often is for non-admins) are silently skipped.

---

## Roadmap

- [ ] Real Xbox Live friends + presence via XSTS-authed REST
- [ ] Real party voice routed through Discord Voice SDK
- [ ] GOG + battle.net scanning
- [ ] In-app Game Bar overlay (capture, record, mic toggle) using `ms-gamebar:` deep links
- [ ] Achievement tracker from Steam / Xbox Live merged into one Gamerscore
- [ ] Big-picture mode: replace `explorer.exe` with Xbox PC for a kiosk Xbox console

PRs welcome.

---

Not affiliated with Microsoft. Xbox is a trademark of Microsoft Corporation. This is a fan-built launcher.
