/* Real installed-games scanner: Xbox app, UWP, Steam, Epic. */
const fs = require('fs');
const path = require('path');
const os = require('os');

const XBOX_GAMES_PATHS = [
    'C:\\XboxGames',
    'D:\\XboxGames',
    'E:\\XboxGames',
    path.join(os.homedir(), 'XboxGames')
];

const UWP_PATH = 'C:\\Program Files\\WindowsApps';

function safeReaddir(p) {
    try { return fs.readdirSync(p); } catch (e) { return []; }
}
function safeStat(p) {
    try { return fs.statSync(p); } catch (e) { return null; }
}
function exists(p) { return !!safeStat(p); }

function shallowSize(p) {
    // Cheap size: top-level files only. Real dirSize is expensive on big games.
    let total = 0;
    for (const f of safeReaddir(p)) {
        const st = safeStat(path.join(p, f));
        if (st && !st.isDirectory()) total += st.size;
    }
    return total;
}

function prettyTitle(folder) {
    return folder
        .replace(/_.*$/, '')
        .replace(/^Microsoft\./, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[.\-_]+/g, ' ')
        .trim();
}

// ---------- Xbox app ----------
function scanXboxGames() {
    const out = [];
    for (const root of XBOX_GAMES_PATHS) {
        if (!exists(root)) continue;
        for (const entry of safeReaddir(root)) {
            const full = path.join(root, entry);
            const st = safeStat(full);
            if (!st || !st.isDirectory()) continue;

            const contentDir = path.join(full, 'Content');
            let exe = null;
            let gameConfig = null;
            for (const f of safeReaddir(contentDir)) {
                const lower = f.toLowerCase();
                if (!exe && lower.endsWith('.exe')) exe = path.join(contentDir, f);
                if (lower === 'microsoftgame.config') gameConfig = path.join(contentDir, f);
            }
            out.push({
                id: 'xboxapp-' + entry,
                source: 'xboxapp',
                title: entry,
                installPath: full,
                exePath: exe,
                gameConfig,
                sizeBytes: shallowSize(contentDir || full),
                state: 'installed'
            });
        }
    }
    return out;
}

// ---------- UWP / Game Pass UWP ----------
function scanUwp() {
    const out = [];
    if (!exists(UWP_PATH)) return out;
    for (const entry of safeReaddir(UWP_PATH)) {
        // Filter to publisher prefixes that are likely games
        if (!/^(Microsoft|Xbox|Ubisoft|EA|Activision|2K|SquareEnix|Rockstar)/i.test(entry)) continue;
        const full = path.join(UWP_PATH, entry);
        const st = safeStat(full);
        if (!st || !st.isDirectory()) continue;
        out.push({
            id: 'uwp-' + entry,
            source: 'uwp',
            title: prettyTitle(entry),
            installPath: full,
            aumid: entry,
            sizeBytes: 0,
            state: 'installed'
        });
    }
    return out;
}

// ---------- Steam ----------
function scanSteam() {
    const out = [];
    const roots = [
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam',
        'D:\\Steam',
        path.join(os.homedir(), 'Steam')
    ].filter(exists);

    for (const sp of roots) {
        const libs = [path.join(sp, 'steamapps')];
        // Honor libraryfolders.vdf if present
        const lvdf = path.join(sp, 'steamapps', 'libraryfolders.vdf');
        if (exists(lvdf)) {
            try {
                const txt = fs.readFileSync(lvdf, 'utf8');
                const matches = txt.match(/"path"\s+"([^"]+)"/g) || [];
                for (const m of matches) {
                    const p = m.match(/"path"\s+"([^"]+)"/);
                    if (p && p[1]) {
                        const extra = path.join(p[1].replace(/\\\\/g, '\\'), 'steamapps');
                        if (exists(extra)) libs.push(extra);
                    }
                }
            } catch (e) {}
        }

        for (const lib of libs) {
            // Parse appmanifest_*.acf for IDs + names
            for (const f of safeReaddir(lib)) {
                if (!/^appmanifest_\d+\.acf$/i.test(f)) continue;
                try {
                    const txt = fs.readFileSync(path.join(lib, f), 'utf8');
                    const idM   = txt.match(/"appid"\s+"(\d+)"/i);
                    const nameM = txt.match(/"name"\s+"([^"]+)"/i);
                    const dirM  = txt.match(/"installdir"\s+"([^"]+)"/i);
                    if (!idM || !nameM) continue;
                    out.push({
                        id: 'steam-' + idM[1],
                        source: 'steam',
                        title: nameM[1],
                        appid: idM[1],
                        installPath: dirM ? path.join(lib, 'common', dirM[1]) : null,
                        sizeBytes: 0,
                        state: 'installed'
                    });
                } catch (e) {}
            }
        }
    }
    return out;
}

// ---------- Epic Games ----------
function scanEpic() {
    const out = [];
    const manifestsDir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
    if (!exists(manifestsDir)) return out;
    for (const f of safeReaddir(manifestsDir)) {
        if (!f.toLowerCase().endsWith('.item')) continue;
        try {
            const j = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
            out.push({
                id: 'epic-' + (j.AppName || f),
                source: 'epic',
                title: j.DisplayName || j.AppName,
                installPath: j.InstallLocation,
                exePath: j.LaunchExecutable ? path.join(j.InstallLocation || '', j.LaunchExecutable) : null,
                appname: j.AppName,
                sizeBytes: j.InstallSize || 0,
                state: 'installed'
            });
        } catch (e) {}
    }
    return out;
}

function scanAll() {
    const all = [];
    try { all.push(...scanXboxGames()); } catch (e) {}
    try { all.push(...scanUwp()); }       catch (e) {}
    try { all.push(...scanSteam()); }     catch (e) {}
    try { all.push(...scanEpic()); }      catch (e) {}
    return all;
}

module.exports = { scanAll, scanXboxGames, scanUwp, scanSteam, scanEpic };
