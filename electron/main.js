/* Xbox PC — Tanner's Edition
   Electron main process: frameless window, tray, autostart, IPC. */

const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage,
        desktopCapturer, Notification, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, exec } = require('child_process');

const isDev = process.argv.includes('--dev');

// Single instance — second launch focuses the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let mainWindow = null;
let tray = null;
let lastCpuTime = null;

function htmlPath() {
    return path.join(__dirname, '..', 'docs', 'xbox.html');
}
function iconPath() {
    const png = path.join(__dirname, 'icon.png');
    if (fs.existsSync(png)) return png;
    return null;
}

function createWindow() {
    const icon = iconPath();
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1100,
        minHeight: 680,
        backgroundColor: '#0a0d12',
        title: 'Xbox PC — Tanner\'s Edition',
        frame: false,
        show: false,
        autoHideMenuBar: true,
        icon: icon || undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            spellcheck: false
        }
    });

    mainWindow.loadFile(htmlPath());
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
            if (tray) tray.displayBalloon && tray.displayBalloon({
                title: 'Xbox PC is still running',
                content: 'Click the tray icon to bring it back.'
            });
        }
    });

    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function buildTrayMenu() {
    return Menu.buildFromTemplate([
        { label: 'Open Xbox Dashboard', click: showWindow },
        { label: 'Take Screenshot',     click: () => mainWindow.webContents.send('native:action', 'screenshot') },
        { label: 'Force Scan Games',    click: () => mainWindow.webContents.send('native:action', 'scan') },
        { type: 'separator' },
        { label: 'Open Xbox App',       click: () => openTool('xbox-app') },
        { label: 'Open Game Bar',       click: () => openTool('game-bar') },
        { label: 'Open Captures Folder',click: () => openTool('captures') },
        { type: 'separator' },
        { label: 'Toggle Boot on Windows Login', type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (mi) => {
              app.setLoginItemSettings({ openAtLogin: mi.checked, path: process.execPath });
          }
        },
        { type: 'separator' },
        { label: 'Quit Xbox PC', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
}

function createTray() {
    let img;
    const ip = iconPath();
    if (ip) img = nativeImage.createFromPath(ip);
    else img = nativeImage.createEmpty();
    if (process.platform === 'win32' && img.isEmpty()) {
        // Fall back to a built-in 16x16 placeholder via Buffer
        try {
            const buf = Buffer.from(
                '89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff61' +
                '0000001b49444154388dedc1010d000000c2a0f74f6d0e37a000000000ef0d1d0001' +
                '0048a82c200000000049454e44ae426082',
                'hex'
            );
            img = nativeImage.createFromBuffer(buf);
        } catch (e) {}
    }
    tray = new Tray(img);
    tray.setToolTip('Xbox PC — Tanner\'s Edition');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
}

function showWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

app.on('second-instance', showWindow);
app.on('before-quit', () => { app.isQuitting = true; });

app.whenReady().then(() => {
    // Default to autostart enabled on first run
    const settings = app.getLoginItemSettings();
    if (settings.openAtLogin === undefined || settings.openAtLogin === false) {
        // Only force-enable on first ever launch
        const flag = path.join(app.getPath('userData'), '.autostart-initialized');
        if (!fs.existsSync(flag)) {
            try {
                app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
                fs.writeFileSync(flag, '1');
            } catch (e) {}
        }
    }

    createWindow();
    createTray();
    setupIpc();

    // Global hotkey: Ctrl+Shift+X brings Xbox dashboard forward
    try {
        globalShortcut.register('Control+Shift+X', showWindow);
    } catch (e) {}
});

app.on('window-all-closed', () => {
    // Stays alive in tray on Windows; quit on macOS only
    if (process.platform === 'darwin') app.quit();
});

app.on('will-quit', () => {
    try { globalShortcut.unregisterAll(); } catch (e) {}
});

// ---------------- IPC ----------------
function setupIpc() {
    ipcMain.handle('app:minimize',   () => mainWindow.minimize());
    ipcMain.handle('app:maximize',   () => {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
        return mainWindow.isMaximized();
    });
    ipcMain.handle('app:close',      () => mainWindow.hide());     // hide to tray
    ipcMain.handle('app:quit',       () => { app.isQuitting = true; app.quit(); });
    ipcMain.handle('app:fullscreen', () => {
        const f = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(f);
        return f;
    });

    ipcMain.handle('autostart:get',  () => app.getLoginItemSettings());
    ipcMain.handle('autostart:set',  (_, enabled) => {
        app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
        if (tray) tray.setContextMenu(buildTrayMenu());
        return app.getLoginItemSettings();
    });

    ipcMain.handle('scan:games',     async () => {
        const scanner = require('./scanner');
        return scanner.scanAll();
    });
    ipcMain.handle('launch:game',    async (_, info) => {
        const launcher = require('./launcher');
        return launcher.launch(info);
    });
    ipcMain.handle('tools:open',     async (_, tool) => openTool(tool));
    ipcMain.handle('tools:openExternal', (_, url) => shell.openExternal(url));
    ipcMain.handle('tools:openPath', (_, p) => shell.openPath(p));

    ipcMain.handle('system:info',    () => systemInfo());
    ipcMain.handle('system:stats',   () => systemStats());

    ipcMain.handle('capture:screenshot', () => takeScreenshot());

    ipcMain.handle('notify',         (_, payload) => {
        if (!Notification.isSupported()) return false;
        const n = new Notification({
            title: payload.title || 'Xbox PC',
            body:  payload.body  || '',
            silent: !!payload.silent
        });
        n.show();
        return true;
    });
}

function openTool(name) {
    const launcher = require('./launcher');
    return launcher.openTool(name);
}

function systemInfo() {
    const cpus = os.cpus();
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpus: cpus.length,
        cpuModel: cpus[0] ? cpus[0].model : 'Unknown',
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        uptime: os.uptime(),
        username: os.userInfo().username,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node
    };
}

function systemStats() {
    // CPU usage via delta on os.cpus().times
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const c of cpus) {
        user += c.times.user; nice += c.times.nice;
        sys  += c.times.sys;  idle += c.times.idle;
        irq  += c.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    const busy  = total - idle;
    let cpuPct = 0;
    if (lastCpuTime) {
        const dt = total - lastCpuTime.total;
        const db = busy  - lastCpuTime.busy;
        cpuPct = dt > 0 ? Math.max(0, Math.min(100, (db / dt) * 100)) : 0;
    }
    lastCpuTime = { total, busy };

    return {
        cpuPct: Math.round(cpuPct),
        memPct: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        uptime: os.uptime(),
        loadAvg: os.loadavg()
    };
}

async function takeScreenshot() {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });
        if (!sources.length) return null;
        const buf = sources[0].thumbnail.toPNG();
        const dir = path.join(os.homedir(), 'Pictures', 'Xbox PC Captures');
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
        const out = path.join(dir, `Xbox-PC-${Date.now()}.png`);
        fs.writeFileSync(out, buf);
        return out;
    } catch (e) {
        return null;
    }
}
