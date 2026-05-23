/* Real game / Xbox-tool launcher for Windows. */
const { shell } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

function launch(game) {
    if (!game) return { ok: false, reason: 'no game' };

    // Native exe (Xbox app installs, Epic, Steam external)
    if (game.exePath) {
        try {
            spawn(game.exePath, [], {
                detached: true, stdio: 'ignore',
                cwd: path.dirname(game.exePath)
            }).unref();
            return { ok: true, via: 'exe' };
        } catch (e) {
            return { ok: false, reason: e.message };
        }
    }

    // Steam → steam://run/<appid>
    if (game.source === 'steam' && game.appid) {
        shell.openExternal(`steam://run/${game.appid}`);
        return { ok: true, via: 'steam-uri' };
    }

    // Epic → com.epicgames.launcher://apps/<appname>?action=launch
    if (game.source === 'epic' && game.appname) {
        shell.openExternal(`com.epicgames.launcher://apps/${game.appname}?action=launch&silent=true`);
        return { ok: true, via: 'epic-uri' };
    }

    // UWP → shell:appsFolder
    if (game.source === 'uwp' && game.aumid) {
        exec(`explorer.exe shell:appsFolder\\${game.aumid}`, { windowsHide: true });
        return { ok: true, via: 'shell-uwp' };
    }

    return { ok: false, reason: 'no launch method' };
}

/* Xbox / Windows quick-tool shortcuts.
   Most are URI handlers so they work even without admin. */
const TOOLS = {
    'xbox-app':    () => shell.openExternal('xbox:'),
    'game-bar':    () => shell.openExternal('ms-gamebar:'),
    'game-pass':   () => shell.openExternal('ms-windows-store://pdp/?productid=CFQ7TTC0KGQ8'),
    'ms-store':    () => shell.openExternal('ms-windows-store:'),
    'capture-folder':   () => shell.openPath(path.join(os.homedir(), 'Videos', 'Captures')),
    'screenshot-folder':() => shell.openPath(path.join(os.homedir(), 'Pictures', 'Screenshots')),
    'xbox-captures-folder': () => shell.openPath(path.join(os.homedir(), 'Pictures', 'Xbox PC Captures')),
    'settings-game-bar':() => shell.openExternal('ms-settings:gaming-gamebar'),
    'settings-game-mode':()=> shell.openExternal('ms-settings:gaming-gamemode'),
    'settings-captures':() => shell.openExternal('ms-settings:gaming-gamedvr'),
    'settings-controller':()=> shell.openExternal('ms-settings:devices-bluetooth'),
    'xbox-account':() => shell.openExternal('https://account.xbox.com/profile'),
    'xbox-friends':() => shell.openExternal('https://account.xbox.com/social'),
    'xbox-rewards':() => shell.openExternal('https://rewards.bing.com/'),
    'gp-pc-library':() => shell.openExternal('https://www.xbox.com/play/library'),
    'gp-cloud':    () => shell.openExternal('https://www.xbox.com/play'),
    'redeem-code': () => shell.openExternal('ms-windows-store://redeem/'),
    'win-game-bar-hotkey': () => {
        // Win+G — invoke via PowerShell SendKeys
        const ps = `Add-Type -AssemblyName System.Windows.Forms; ` +
                   `[System.Windows.Forms.SendKeys]::SendWait('^{ESC}')`; // approx
        exec(`powershell -NoProfile -WindowStyle Hidden -Command "${ps}"`, { windowsHide: true });
    },
    'task-manager':() => exec('taskmgr', { windowsHide: true }),
    'open-xbox-insider':() => shell.openExternal('https://www.xbox.com/insider'),
    'open-game-pass-quests':() => shell.openExternal('https://www.xbox.com/play/quests')
};

function openTool(name) {
    const t = TOOLS[name];
    if (!t) return { ok: false, reason: 'unknown tool ' + name };
    try { t(); return { ok: true }; }
    catch (e) { return { ok: false, reason: e.message }; }
}

module.exports = { launch, openTool, TOOLS_LIST: Object.keys(TOOLS) };
