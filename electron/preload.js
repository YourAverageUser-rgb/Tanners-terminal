/* preload — exposes a safe `window.XboxNative` API to the renderer. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('XboxNative', {
    isElectron: true,
    version: '1.0.0',

    window: {
        minimize:    ()    => ipcRenderer.invoke('app:minimize'),
        close:       ()    => ipcRenderer.invoke('app:close'),
        maximize:    ()    => ipcRenderer.invoke('app:maximize'),
        quit:        ()    => ipcRenderer.invoke('app:quit'),
        fullscreen:  ()    => ipcRenderer.invoke('app:fullscreen')
    },

    autostart: {
        get: () => ipcRenderer.invoke('autostart:get'),
        set: (enabled) => ipcRenderer.invoke('autostart:set', enabled)
    },

    scanInstalled: () => ipcRenderer.invoke('scan:games'),
    launchGame:    (info) => ipcRenderer.invoke('launch:game', info),
    openTool:      (tool) => ipcRenderer.invoke('tools:open', tool),
    openUrl:       (url)  => ipcRenderer.invoke('tools:openExternal', url),
    openPath:      (p)    => ipcRenderer.invoke('tools:openPath', p),

    systemInfo:    () => ipcRenderer.invoke('system:info'),
    systemStats:   () => ipcRenderer.invoke('system:stats'),

    screenshot:    () => ipcRenderer.invoke('capture:screenshot'),

    notify:        (title, body, silent) => ipcRenderer.invoke('notify', { title, body, silent }),

    on: (channel, fn) => {
        if (channel === 'action') {
            ipcRenderer.on('native:action', (_, payload) => fn(payload));
        }
    }
});
