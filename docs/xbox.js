/* Xbox PC — Tanner's Edition
   Main dashboard logic: pages, library, store, friends, party, messages,
   guide overlay, theme + mode switch, simulated downloads + auto-scan. */
(function () {
    "use strict";

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ---------- Persistence ----------
    const LS_KEY = "xbox-pc-state-v1";
    function loadState() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }
    function saveState() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    }

    const persisted = loadState() || {};

    const state = {
        page: persisted.page || "home",
        theme: persisted.theme || "seriesx",
        mode: persisted.mode || "tv",
        gamertag: persisted.gamertag || "TannerPC",
        realName: persisted.realName || "Tanner",
        gamerscore: persisted.gamerscore || 14250,
        libFilter: "all",
        friendFilter: "online",
        msgOpen: null,
        party: persisted.party || null, // { name, members: [{gt,avatar,muted}] }
        autoScan: persisted.autoScan !== false,
        scanInterval: persisted.scanInterval || 300,
        lastScan: persisted.lastScan || null,
        // Game library — clone of base data + persistent overrides
        games: null,
        readGames: persisted.readGames || []
    };

    function rebuildGames() {
        const overrides = persisted.gameOverrides || {};
        state.games = XboxData.baseGames.map(g => {
            const o = overrides[g.id];
            return o ? Object.assign({}, g, o) : Object.assign({}, g);
        });
    }
    rebuildGames();

    function saveGameOverrides() {
        const o = {};
        for (const g of state.games) {
            o[g.id] = { state: g.state, progress: g.progress, eta: g.eta, hours: g.hours };
        }
        persisted.gameOverrides = o;
        // Also fold all persisted fields back
        Object.assign(persisted, {
            page: state.page, theme: state.theme, mode: state.mode,
            gamertag: state.gamertag, realName: state.realName, gamerscore: state.gamerscore,
            party: state.party, autoScan: state.autoScan,
            scanInterval: state.scanInterval, lastScan: state.lastScan,
            readGames: state.readGames
        });
        localStorage.setItem(LS_KEY, JSON.stringify(persisted));
    }

    // ---------- Boot ----------
    window.addEventListener('load', () => {
        setTimeout(boot, 2400);
    });

    function boot() {
        $('#boot').classList.add('fade');
        setTimeout(() => { $('#boot').remove(); }, 600);

        $('#topbar').classList.remove('hidden');
        $('#sidebar').classList.remove('hidden');
        $('#content').classList.remove('hidden');

        // Electron detection
        if (window.XboxNative && window.XboxNative.isElectron) {
            document.body.dataset.electron = "true";
            $('#windowControls').hidden = false;
            $('#nativeBadge').style.display = "inline-block";
            $('#modeBadge').textContent = "Native · Windows";
            $('#modeBadge').classList.add('green');
            $('#electronHint').hidden = false;
            $('#webHint').hidden = true;
            $('#nativeAutostartRow').hidden = false;
            $('#nativeHotkeyRow').hidden = false;
            bindWindowControls();
            bindNativeBridge();
        }

        applyTheme(state.theme);
        applyMode(state.mode);

        $('#gtName').textContent = state.gamertag;
        $('#avatar').textContent = state.gamertag[0].toUpperCase();
        $('#guideName').textContent = state.gamertag;
        $('#guideAvatar').textContent = state.gamertag[0].toUpperCase();
        $('#gtScore').textContent = state.gamerscore.toLocaleString();
        $('#gsTotal').textContent = state.gamerscore.toLocaleString();

        $('#inpGT').value = state.gamertag;
        $('#inpName').value = state.realName;
        $('#toggleScan').checked = state.autoScan;
        $('#scanInterval').value = String(state.scanInterval);

        bindNav();
        bindGuide();
        bindSettings();
        bindLibrary();
        bindParty();
        bindMessages();
        bindTopbar();

        renderHome();
        renderLibrary();
        renderStore();
        renderGamepass();
        renderCloud();
        renderFriends();
        renderParty();
        renderMessages();
        renderAchievements();
        renderCaptures();
        renderTools();
        bindTools();

        navigate(state.page, true);
        startClock();
        startDownloadLoop();
        startAutoScan();
        startVisibilityScan();

        toast("Welcome back, " + state.gamertag, "Press Space or Xbox button for the guide.");

        // Set initial focus on a nav item
        const firstNav = document.querySelector('.nav-item.active');
        if (firstNav) XboxInput.setFocus(firstNav);
    }

    // ---------- Theme & mode ----------
    function applyTheme(theme) {
        state.theme = theme;
        document.body.dataset.theme = theme;
        $$('.seg-btn[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
        saveGameOverrides();
    }
    function applyMode(mode) {
        state.mode = mode;
        document.body.dataset.mode = mode;
        $$('.seg-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        saveGameOverrides();
    }

    // ---------- Top bar ----------
    function bindTopbar() {
        $('#btnGuide').addEventListener('click', toggleGuide);
        $('#dlChip').addEventListener('click', () => navigate('games', false, () => {
            applyLibraryFilter('downloading');
        }));
        $('.gamertag-chip').addEventListener('click', () => navigate('settings'));
    }
    function startClock() {
        const tick = () => {
            const d = new Date();
            const hh = d.getHours();
            const mm = String(d.getMinutes()).padStart(2, "0");
            const ampm = hh >= 12 ? "PM" : "AM";
            const h12 = ((hh + 11) % 12) + 1;
            $('#clock').textContent = `${h12}:${mm} ${ampm}`;
        };
        tick(); setInterval(tick, 30000);
    }

    // ---------- Navigation ----------
    function bindNav() {
        $$('.nav-item').forEach(n => n.addEventListener('click', () => navigate(n.dataset.page)));
        XboxInput.on('back', () => {
            if (!$('#guide').hasAttribute('hidden')) { toggleGuide(false); return; }
            if (state.page !== 'home') navigate('home');
        });
        XboxInput.on('guide', toggleGuide);
        XboxInput.on('view', () => navigate('captures'));
        XboxInput.on('menu', () => navigate('settings'));
        XboxInput.on('tabPrev', () => cycleNav(-1));
        XboxInput.on('tabNext', () => cycleNav(+1));
        XboxInput.on('info',    () => { /* quick info - currently a toast */
            const t = $('.focused .tile-title') || $('.focused .friend-name');
            if (t) toast("Quick info", t.textContent);
        });
        XboxInput.on('context', () => {
            const t = $('.focused .tile-title') || $('.focused .friend-name');
            if (t) toast("Options", `Context menu for ${t.textContent}`);
        });
    }
    function navigate(page, skipSave, after) {
        state.page = page;
        $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
        $('#content').scrollTo(0, 0);
        if (!skipSave) saveGameOverrides();
        // Move focus to first focusable on the new page
        requestAnimationFrame(() => {
            const target = document.querySelector(`.page[data-page="${page}"] [data-focus]`);
            if (target) XboxInput.setFocus(target);
            if (after) after();
        });
    }
    function cycleNav(dir) {
        const navs = $$('.nav-item');
        const i = navs.findIndex(n => n.classList.contains('active'));
        const next = navs[(i + dir + navs.length) % navs.length];
        if (next) navigate(next.dataset.page);
    }

    // ---------- Home page ----------
    function renderHome() {
        const featured = state.games.find(g => g.id === "fh5") || state.games[0];
        $('#heroBg').style.backgroundImage = featured.art;
        $('#heroTitle').textContent = featured.title;
        $('#heroSub').textContent = `Resume your last session · ${featured.hours}h played`;
        $('#heroPlay').onclick = () => playGame(featured);
        $('#heroDetails').onclick = () => toast(featured.title, `${featured.studio} · ${featured.size} GB`);

        const recents = state.games.filter(g => g.state === "installed" || g.state === "downloading").slice(0, 10);
        $('#recentRow').innerHTML = recents.map(tileHtml).join("");

        const online = XboxData.friends.filter(f => f.status !== "offline");
        $('#friendRow').innerHTML = online.map(friendPillHtml).join("");

        $('#gamepassRow').innerHTML = XboxData.gamepassRecent.map(g => tileHtml(g, "ready")).join("");

        $('#achievementsRow').innerHTML = XboxData.achievements
            .filter(a => a.recent && a.unlocked)
            .map(achHtml)
            .join("");

        bindRowEvents();
    }

    function tileHtml(g, forceState) {
        const st = forceState || g.state;
        const sub = st === "downloading"
            ? `<span>${g.progress || 0}%</span><span>${g.eta || ""}</span>`
            : `<span>${stateLabel(st)}</span><span>${g.size ? g.size + " GB" : ""}</span>`;

        const dl = st === "downloading"
            ? `<div class="dl-bar"><div class="dl-bar-fill" style="width:${g.progress || 0}%"></div></div>
               <div class="dl-pct">${g.progress || 0}%</div>`
            : "";

        return `
        <div class="tile" data-focus tabindex="0" data-gid="${g.id}">
            <div class="tile-art" style="background-image:${g.art}"></div>
            ${dl}
            <div class="tile-body">
                <div class="tile-title">${g.title}</div>
                <div class="tile-sub">${sub}</div>
            </div>
        </div>`;
    }
    function stateLabel(s) {
        return { installed: "Installed", downloading: "Downloading", cloud: "Cloud", ready: "Ready to install" }[s] || s;
    }

    function friendPillHtml(f) {
        return `
        <div class="friend-pill" data-focus tabindex="0" data-friend="${f.gt}">
            <div class="avatar">${f.avatar}</div>
            <div class="friend-meta">
                <div class="friend-name">${f.gt}</div>
                <div class="friend-game">${f.game}</div>
            </div>
            <div class="friend-status-dot ${f.status}"></div>
        </div>`;
    }
    function achHtml(a) {
        return `
        <div class="ach" data-focus tabindex="0">
            <div class="ach-icon">🏆</div>
            <div class="ach-meta">
                <div class="ach-title">${a.title}</div>
                <div class="ach-sub">${a.game} · ${a.desc}</div>
            </div>
            <div class="ach-g">${a.gs} G</div>
        </div>`;
    }

    function bindRowEvents() {
        $$('.tile[data-gid]').forEach(t => {
            t.addEventListener('click', () => {
                const g = state.games.find(x => x.id === t.dataset.gid)
                       || XboxData.storeGames.find(x => x.id === t.dataset.gid)
                       || XboxData.gamepassRecent.find(x => x.id === t.dataset.gid)
                       || XboxData.cloudGames.find(x => x.id === t.dataset.gid);
                if (!g) return;
                handleGameClick(g, t);
            });
        });
        $$('.friend-pill[data-friend], .friend-card[data-friend]').forEach(p => {
            p.addEventListener('click', () => {
                const gt = p.dataset.friend;
                openMessageWith(gt) || toast(gt, "Friend options · invite to party, message, view profile");
            });
        });
    }

    function handleGameClick(g, el) {
        if (g.state === "installed") {
            playGame(g);
        } else if (g.state === "downloading") {
            toast(g.title, `Downloading · ${g.progress || 0}%`);
        } else if (g.state === "ready" || g.state === "cloud") {
            installGame(g);
        } else if (g.price) {
            // Store item
            installGame({ ...g, state: "ready", size: 60, studio: "Microsoft", hours: 0 });
        }
    }

    function playGame(g) {
        if (window.XboxNative && g.native) {
            toast("Launching " + g.title, "Starting via " + g.native.source);
            XboxInput.rumble(0.7, 0.7, 500);
            XboxNative.launchGame(g.native).then(res => {
                if (!res || !res.ok) {
                    toast("Couldn't launch", res && res.reason || "no launch method available");
                } else {
                    XboxNative.notify && XboxNative.notify("Playing " + g.title, "Launched from " + g.native.source);
                }
            });
        } else {
            toast("Launching " + g.title, window.XboxNative
                ? "Simulated launch — game has no native install path."
                : "Install the Windows build to launch real games.");
            XboxInput.rumble(0.6, 0.6, 400);
        }
        g.hours = (g.hours || 0) + 1;
        saveGameOverrides();
        renderHome(); renderLibrary();
    }

    function installGame(g) {
        // Add or convert to downloading
        let existing = state.games.find(x => x.id === g.id);
        if (!existing) {
            existing = Object.assign({}, g, { state: "downloading", progress: 0, eta: "Calculating...", size: g.size || 60, hours: 0 });
            state.games.push(existing);
        } else {
            existing.state = "downloading";
            existing.progress = 0;
            existing.eta = "Calculating...";
        }
        toast("Installing " + g.title, "Queued for download from Xbox app · 0%");
        saveGameOverrides();
        renderHome(); renderLibrary(); updateDownloadChip();
    }

    // ---------- Library ----------
    function bindLibrary() {
        $$('.chip[data-filter]').forEach(c => {
            c.addEventListener('click', () => applyLibraryFilter(c.dataset.filter));
        });
        $('#rescanBtn').addEventListener('click', runScan);
    }
    function applyLibraryFilter(f) {
        state.libFilter = f;
        $$('.chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
        renderLibrary();
    }
    function renderLibrary() {
        const games = state.games;
        const filtered = state.libFilter === "all"
            ? games
            : games.filter(g => g.state === state.libFilter);
        $('#libCount').textContent = `${filtered.length} of ${games.length} games`;
        $('#libraryGrid').innerHTML = filtered.length
            ? filtered.map(tileHtml).join("")
            : `<div class="muted" style="padding:20px">Nothing matches that filter.</div>`;
        $('#lastScan').textContent = state.lastScan
            ? "Last scan: " + state.lastScan
            : "Last scan: never";
        bindRowEvents();
        updateDownloadChip();
    }
    function updateDownloadChip() {
        const dl = state.games.filter(g => g.state === "downloading");
        const chip = $('#dlChip');
        if (!dl.length) { chip.hidden = true; return; }
        chip.hidden = false;
        $('#dlChipText').textContent = dl.length === 1
            ? `${dl[0].title} · ${dl[0].progress || 0}%`
            : `${dl.length} downloads`;
    }

    // Download progress simulation
    function startDownloadLoop() {
        setInterval(() => {
            let dirty = false;
            for (const g of state.games) {
                if (g.state !== "downloading") continue;
                const inc = 0.6 + Math.random() * 1.4;
                g.progress = Math.min(100, (g.progress || 0) + inc);
                const remaining = 100 - g.progress;
                g.eta = remaining < 1 ? "Finishing..." :
                        `${Math.ceil(remaining * 0.6)} min left`;
                if (g.progress >= 100) {
                    g.progress = 100;
                    g.state = "installed";
                    g.eta = "";
                    toast("Install complete", `${g.title} is ready to play.`);
                    XboxInput.rumble(0.3, 0.6, 250);
                }
                dirty = true;
            }
            if (dirty) {
                saveGameOverrides();
                // Cheap re-render only of affected views
                if (state.page === "games") renderLibrary();
                if (state.page === "home")  renderHome();
                updateDownloadChip();
            }
        }, 1500);
    }

    // ---------- Store ----------
    function renderStore() {
        const items = XboxData.storeGames.map(g => `
            <div class="tile" data-focus tabindex="0" data-gid="${g.id}">
                <div class="tile-art" style="background-image:${g.art}"></div>
                <div class="tile-body">
                    <div class="tile-title">${g.title}</div>
                    <div class="tile-sub"><span>${g.price}</span><span>Get</span></div>
                </div>
            </div>`).join("");
        $('#storeGrid').innerHTML = items;
        bindRowEvents();
    }
    function renderGamepass() {
        $('#passGrid').innerHTML = XboxData.gamepassRecent.map(g => `
            <div class="tile" data-focus tabindex="0" data-gid="${g.id}">
                <div class="tile-art" style="background-image:${g.art}"></div>
                <div class="tile-body">
                    <div class="tile-title">${g.title}</div>
                    <div class="tile-sub"><span>Game Pass</span><span>Install</span></div>
                </div>
            </div>`).join("");
        bindRowEvents();
    }
    function renderCloud() {
        $('#cloudGrid').innerHTML = XboxData.cloudGames.map(g => `
            <div class="tile" data-focus tabindex="0" data-gid="${g.id}">
                <div class="tile-art" style="background-image:${g.art}"></div>
                <div class="tile-body">
                    <div class="tile-title">${g.title}</div>
                    <div class="tile-sub"><span>Stream</span><span>▶ Play</span></div>
                </div>
            </div>`).join("");
        bindRowEvents();
    }

    // ---------- Friends ----------
    function renderFriends() {
        const all = XboxData.friends;
        const total = all.length;
        const online = all.filter(f => f.status !== "offline").length;
        $('#friendsOnlineCount').textContent = online;
        $('#friendsTotalCount').textContent = total;

        $$('.chip[data-friend-filter]').forEach(c => {
            c.addEventListener('click', () => {
                state.friendFilter = c.dataset.friendFilter;
                $$('.chip[data-friend-filter]').forEach(b => b.classList.toggle('active', b.dataset.friendFilter === state.friendFilter));
                drawFriendList();
            });
        });
        drawFriendList();
    }
    function drawFriendList() {
        const f = state.friendFilter;
        const list = XboxData.friends.filter(x =>
            f === "all" ? true :
            f === "online" ? x.status !== "offline" :
            f === "ingame" ? x.status === "ingame" :
            f === "party" ? x.status === "party" : true);
        $('#friendList').innerHTML = list.map(x => `
            <div class="friend-card" data-focus tabindex="0" data-friend="${x.gt}">
                <div class="avatar">${x.avatar}</div>
                <div class="friend-meta">
                    <div class="friend-name">${x.gt}</div>
                    <div class="friend-game">${x.game}</div>
                </div>
                <div class="friend-status-dot ${x.status}"></div>
            </div>`).join("");
        bindRowEvents();
    }

    // ---------- Party ----------
    function bindParty() {
        $('#startPartyBtn').addEventListener('click', () => {
            state.party = {
                name: `${state.gamertag}'s Party`,
                members: [{ gt: state.gamertag, avatar: state.gamertag[0], muted: false, host: true }]
            };
            toast("Party started", "Voice chat ready · invite friends");
            XboxInput.rumble(0.4, 0.4, 200);
            saveGameOverrides();
            renderParty();
        });
        $('#leavePartyBtn')?.addEventListener('click', leaveParty);
        document.addEventListener('click', (e) => {
            if (e.target.matches('#muteBtn')) {
                const me = state.party.members.find(m => m.gt === state.gamertag);
                me.muted = !me.muted;
                toast("Microphone", me.muted ? "Muted" : "Unmuted");
                saveGameOverrides();
                renderParty();
            } else if (e.target.matches('#deafenBtn')) {
                toast("Audio", "Toggled deafen");
            } else if (e.target.matches('#inviteFriendsBtn')) {
                toast("Invite", "Pick a friend from the right panel.");
            } else if (e.target.matches('#partyChatBtn')) {
                toast("Party chat", "Opening text chat overlay (mock).");
            }
        });
    }
    function leaveParty() {
        state.party = null;
        saveGameOverrides();
        toast("Left party", "");
        renderParty();
    }
    function renderParty() {
        const empty = $('#partyEmpty');
        const active = $('#partyActive');
        if (!state.party) {
            empty.hidden = false; active.hidden = true;
            $('#partySubtitle').textContent = "Voice chat with up to 16 friends";
        } else {
            empty.hidden = true; active.hidden = false;
            $('#partyName').textContent = state.party.name;
            $('#partyCount').textContent = state.party.members.length;
            $('#partyMembers').innerHTML = state.party.members.map(m => `
                <li>
                    <div class="avatar">${m.avatar}</div>
                    <div>
                        <div class="friend-name">${m.gt}${m.host ? " · host" : ""}</div>
                        <div class="friend-game">${m.host ? "You" : "Connected"}</div>
                    </div>
                    <div class="mic ${m.muted ? "muted" : ""}">${m.muted ? "🚫" : "🎙"}</div>
                </li>`).join("");
            $('#partySubtitle').textContent = `In party · ${state.party.members.length}/16`;
        }
        // Invite list (online friends not in party)
        const inParty = new Set(state.party ? state.party.members.map(m => m.gt) : []);
        const candidates = XboxData.friends.filter(f => f.status !== "offline" && !inParty.has(f.gt));
        $('#inviteList').innerHTML = candidates.map(f => `
            <li data-focus tabindex="0" data-invite="${f.gt}">
                <div class="avatar">${f.avatar}</div>
                <div class="name">${f.gt}</div>
                <div class="send">Invite ▶</div>
            </li>`).join("");
        $$('#inviteList li').forEach(li => {
            li.addEventListener('click', () => addToParty(li.dataset.invite));
        });
    }
    function addToParty(gt) {
        if (!state.party) {
            state.party = { name: `${state.gamertag}'s Party`, members: [{ gt: state.gamertag, avatar: state.gamertag[0], muted: false, host: true }] };
        }
        const f = XboxData.friends.find(x => x.gt === gt);
        if (!f) return;
        if (state.party.members.length >= 16) {
            toast("Party full", "Max 16 members"); return;
        }
        state.party.members.push({ gt: f.gt, avatar: f.avatar, muted: false });
        toast(`${f.gt} joined the party`, "");
        XboxInput.rumble(0.3, 0.3, 150);
        saveGameOverrides();
        renderParty();
    }

    // ---------- Messages ----------
    function bindMessages() {
        // event delegation handled in renderMessages
    }
    function renderMessages() {
        const unread = XboxData.messages.filter(m => m.unread).length;
        $('#msgBadge').textContent = unread || "";
        $('#msgBadge').style.display = unread ? "inline-block" : "none";

        $('#msgList').innerHTML = XboxData.messages.map(m => `
            <div class="msg-row ${state.msgOpen === m.id ? "active" : ""}" data-focus tabindex="0" data-mid="${m.id}">
                <div class="avatar">${m.avatar}</div>
                <div class="msg-meta">
                    <div class="msg-name">${m.with}${m.unread ? " <span class='badge'>•</span>" : ""}</div>
                    <div class="msg-preview">${m.preview}</div>
                </div>
                <div class="msg-time">${m.time}</div>
            </div>`).join("");

        $$('.msg-row').forEach(r => r.addEventListener('click', () => openMessage(r.dataset.mid)));

        if (state.msgOpen) renderThread(state.msgOpen);
        else $('#msgThread').innerHTML = `<div class="msg-empty">Pick a conversation</div>`;
    }
    function openMessageWith(gt) {
        const m = XboxData.messages.find(x => x.with === gt);
        if (!m) return false;
        navigate('messages', false, () => openMessage(m.id));
        return true;
    }
    function openMessage(id) {
        state.msgOpen = id;
        const m = XboxData.messages.find(x => x.id === id);
        if (!m) return;
        m.unread = false;
        renderMessages();
        renderThread(id);
    }
    function renderThread(id) {
        const m = XboxData.messages.find(x => x.id === id);
        if (!m) return;
        const bubbles = m.thread.map(t => `
            <div class="bubble ${t.from === "me" ? "me" : ""}">${escapeHtml(t.text)}<span class="b-time">${t.at}</span></div>
        `).join("");
        $('#msgThread').innerHTML = `
            <div class="msg-thread-head">
                <div class="avatar">${m.avatar}</div>
                <div>
                    <div class="msg-name">${m.with}</div>
                    <div class="msg-preview">Online</div>
                </div>
                <button class="btn ghost" data-focus id="inviteFromMsg" style="margin-left:auto">+ Invite to party</button>
            </div>
            <div class="msg-bubble-list" id="bubbleList">${bubbles}</div>
            <form class="msg-input" id="msgInputForm">
                <input id="msgInputBox" placeholder="Send a message..." autocomplete="off"/>
                <button class="btn primary" data-focus type="submit">Send</button>
            </form>
        `;
        $('#inviteFromMsg').addEventListener('click', () => addToParty(m.with));
        const list = $('#bubbleList'); list.scrollTop = list.scrollHeight;
        $('#msgInputForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = $('#msgInputBox').value.trim();
            if (!text) return;
            m.thread.push({ from: "me", text, at: nowLabel() });
            m.preview = text; m.time = "now";
            $('#msgInputBox').value = "";
            renderThread(id); renderMessages();
            // Simulate a reply
            setTimeout(() => {
                const replies = ["k","sounds good","gg","lol","invite me","on my way"];
                const r = replies[Math.floor(Math.random()*replies.length)];
                m.thread.push({ from: m.with, text: r, at: nowLabel() });
                m.preview = r; m.time = "now";
                if (state.page !== 'messages' || state.msgOpen !== id) {
                    m.unread = true;
                    toast("New message", `${m.with}: ${r}`);
                }
                renderThread(id); renderMessages();
            }, 1100 + Math.random()*1500);
        });
    }

    // ---------- Achievements ----------
    function renderAchievements() {
        $('#achCount').textContent = XboxData.achievements.filter(a => a.unlocked).length + " / " + XboxData.achievements.length;
        $('#achList').innerHTML = XboxData.achievements.map(a => `
            <div class="ach" data-focus tabindex="0" style="${a.unlocked ? "" : "opacity:0.55"}">
                <div class="ach-icon">${a.unlocked ? "🏆" : "🔒"}</div>
                <div class="ach-meta">
                    <div class="ach-title">${a.title}</div>
                    <div class="ach-sub">${a.game} · ${a.desc}</div>
                </div>
                <div class="ach-g">${a.gs} G</div>
            </div>`).join("");
    }

    // ---------- Captures ----------
    function renderCaptures() {
        $('#captureGrid').innerHTML = XboxData.captures.map(c => `
            <div class="capture" data-focus tabindex="0" data-label="${c.label}" style="background:linear-gradient(135deg, ${c.c1}, ${c.c2})"></div>
        `).join("");
    }

    // ---------- Settings ----------
    function bindSettings() {
        $$('.seg-btn[data-theme]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
        $$('.seg-btn[data-mode]').forEach(b => b.addEventListener('click', () => applyMode(b.dataset.mode)));

        $('#btnFullscreen').addEventListener('click', () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
            else document.exitFullscreen();
        });

        $('#btnCopyShortcut').addEventListener('click', () => {
            const cmd = "start " + location.href;
            navigator.clipboard.writeText(cmd).then(
                () => toast("Copied!", "Paste this into a .bat file in shell:startup"),
                () => toast("Copy failed", "Manually copy: " + cmd)
            );
        });

        $('#btnRumble').addEventListener('click', () => {
            XboxInput.rumble(0.7, 0.7, 600).then(ok => {
                if (!ok) toast("No controller", "Plug in an Xbox controller to test vibration.");
            });
        });

        $('#toggleScan').addEventListener('change', e => { state.autoScan = e.target.checked; saveGameOverrides(); });
        $('#scanInterval').addEventListener('change', e => { state.scanInterval = parseInt(e.target.value, 10); saveGameOverrides(); startAutoScan(); });
        $('#forceScan').addEventListener('click', runScan);

        $('#saveProfile').addEventListener('click', () => {
            state.gamertag = $('#inpGT').value || state.gamertag;
            state.realName = $('#inpName').value || state.realName;
            $('#gtName').textContent = state.gamertag;
            $('#avatar').textContent = state.gamertag[0].toUpperCase();
            $('#guideName').textContent = state.gamertag;
            $('#guideAvatar').textContent = state.gamertag[0].toUpperCase();
            saveGameOverrides();
            toast("Profile saved", "Welcome, " + state.gamertag);
        });
        $('#resetAll').addEventListener('click', () => {
            if (confirm("Reset all dashboard data?")) {
                localStorage.removeItem(LS_KEY);
                location.reload();
            }
        });

        // Controller status
        XboxInput.on('padconnect', (pad) => {
            $('#padStatus').textContent = pad.id;
            const ph = $('#padHint');
            ph.hidden = false;
            setTimeout(() => ph.hidden = true, 2500);
            toast("Controller connected", pad.id);
        });
        XboxInput.on('paddisconnect', () => {
            $('#padStatus').textContent = "No controller";
            toast("Controller disconnected", "");
        });
    }

    // ---------- Guide overlay ----------
    function bindGuide() {
        $('#closeGuide').addEventListener('click', () => toggleGuide(false));
        $$('.g-tab').forEach(t => t.addEventListener('click', () => switchGuideTab(t.dataset.gtab)));
        renderGuide('home');
    }
    function toggleGuide(forceState) {
        const el = $('#guide');
        const willOpen = forceState === undefined ? el.hasAttribute('hidden') : !!forceState;
        if (willOpen) {
            el.hidden = false;
            requestAnimationFrame(() => {
                const first = el.querySelector('[data-focus]');
                if (first) XboxInput.setFocus(first);
            });
        } else {
            el.hidden = true;
            // Restore focus to a sane page element
            const target = document.querySelector(`.page[data-page="${state.page}"] [data-focus]`) || document.querySelector('.nav-item.active');
            if (target) XboxInput.setFocus(target);
        }
    }
    function switchGuideTab(tab) {
        $$('.g-tab').forEach(t => t.classList.toggle('active', t.dataset.gtab === tab));
        renderGuide(tab);
    }
    function renderGuide(tab) {
        const body = $('#guideBody');
        if (tab === 'home') {
            body.innerHTML = `
                ${guideTile('🏠','Home','Back to dashboard','go:home')}
                ${guideTile('🎮','My library','Browse installed games','go:games')}
                ${guideTile('▶','Play last game','Resume Forza Horizon 5','play:fh5')}
                ${guideTile('🛒','Store','Find new games','go:store')}
                ${guideTile('⚙','Settings','Switch dashboard versions','go:settings')}
            `;
        } else if (tab === 'party') {
            const inParty = !!state.party;
            body.innerHTML = `
                ${inParty
                    ? guideTile('🎧','Your party',`${state.party.members.length} members`,'go:parties')
                    : guideTile('🎧','Start a party','Open voice chat','startParty')}
                ${guideTile('👥','Invite friends','Pick from online friends','go:parties')}
                ${guideTile('💬','Party chat','Open text overlay','toast:Party text chat')}
            `;
        } else if (tab === 'friends') {
            const online = XboxData.friends.filter(f => f.status !== 'offline').slice(0, 8);
            body.innerHTML = online.map(f => guideTile(f.avatar, f.gt, f.game, `dm:${f.gt}`)).join("");
        } else if (tab === 'messages') {
            body.innerHTML = XboxData.messages.slice(0,6).map(m =>
                guideTile(m.avatar, m.with, m.preview, `dm:${m.with}`)).join("");
        } else if (tab === 'capture') {
            body.innerHTML = `
                ${guideTile('📸','Take a screenshot','Saved to Captures','capture:shot')}
                ${guideTile('🎥','Record last 30 sec','Background clip','capture:clip')}
                ${guideTile('📁','Open Captures','View your media','go:captures')}
            `;
        } else if (tab === 'power') {
            body.innerHTML = `
                ${guideTile('🌙','Sleep mode','Lock the dashboard','power:sleep')}
                ${guideTile('🔄','Restart Xbox','Reload the app','power:restart')}
                ${guideTile('⏻','Sign out','Switch profile','power:signout')}
                ${guideTile('🖥','Quit to desktop','Close Xbox dashboard','power:quit')}
            `;
        }
        // bind tile actions
        $$('#guideBody .guide-tile').forEach(t => t.addEventListener('click', () => handleGuideAction(t.dataset.act)));
    }
    function guideTile(ico, t, s, act) {
        return `<div class="guide-tile" data-focus tabindex="0" data-act="${act || ''}">
            <div class="ico">${ico}</div>
            <div>
                <div class="t">${t}</div>
                <div class="s">${s}</div>
            </div>
        </div>`;
    }
    function handleGuideAction(act) {
        if (!act) return;
        if (act.startsWith('go:')) { toggleGuide(false); navigate(act.slice(3)); return; }
        if (act === 'startParty') {
            $('#startPartyBtn').click(); toggleGuide(false); navigate('parties'); return;
        }
        if (act.startsWith('dm:')) {
            toggleGuide(false); openMessageWith(act.slice(3)); return;
        }
        if (act.startsWith('play:')) {
            const g = state.games.find(x => x.id === act.slice(5));
            if (g) { toggleGuide(false); playGame(g); }
            return;
        }
        if (act === 'capture:shot') { toast("Screenshot saved", "View it in Captures."); return; }
        if (act === 'capture:clip') { toast("Clip saved", "Last 30 seconds captured."); return; }
        if (act.startsWith('toast:')) { toast(act.slice(6), ""); return; }
        if (act.startsWith('power:')) {
            const p = act.slice(6);
            if (p === 'restart' || p === 'quit') {
                toast("Restarting Xbox dashboard...", "");
                setTimeout(() => location.reload(), 700);
            } else if (p === 'sleep') {
                toast("Going to sleep", "Tap Space to wake.");
            } else if (p === 'signout') {
                toast("Signed out", "Reset profile from Settings.");
            }
        }
    }

    // ---------- Toast ----------
    function toast(title, sub) {
        const w = $('#toastWrap');
        const t = document.createElement('div');
        t.className = "toast";
        t.innerHTML = `<div class="t-title">${escapeHtml(title)}</div>${sub ? `<div class="t-sub">${escapeHtml(sub)}</div>` : ""}`;
        w.appendChild(t);
        setTimeout(() => t.style.opacity = 0, 4000);
        setTimeout(() => t.remove(), 4600);
    }

    // ---------- Auto-scan ----------
    let scanTimer = null;
    function startAutoScan() {
        clearInterval(scanTimer);
        if (!state.scanInterval || state.scanInterval <= 0) return;
        scanTimer = setInterval(runScan, state.scanInterval * 1000);
    }
    function startVisibilityScan() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state.autoScan) {
                // "Closed" — schedule a scan when we come back
                state._pendingScan = true;
            } else if (!document.hidden && state._pendingScan) {
                state._pendingScan = false;
                runScan();
            }
        });
    }
    function runScan() {
        if (window.XboxNative) { doNativeScan(); return; }
        state.lastScan = nowLabel();
        saveGameOverrides();
        // 25% chance a "new" install appears (cycles through ready-list)
        const candidates = state.games.filter(g => g.state === "ready");
        if (candidates.length && Math.random() < 0.35) {
            const g = candidates[Math.floor(Math.random()*candidates.length)];
            toast("New game detected", `${g.title} is ready to install from the Xbox app.`);
        } else {
            toast("Scan complete", "No new installs found.");
        }
        renderLibrary();
    }

    // ---------- Helpers ----------
    function nowLabel() {
        const d = new Date();
        const hh = d.getHours();
        const mm = String(d.getMinutes()).padStart(2,"0");
        const ampm = hh >= 12 ? "PM" : "AM";
        const h12 = ((hh + 11) % 12) + 1;
        return `${h12}:${mm} ${ampm}`;
    }
    function escapeHtml(s) {
        return String(s || "").replace(/[&<>"']/g, c => ({
            "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[c]));
    }
    function fmtBytes(n) {
        if (!n) return "0 B";
        const u = ["B","KB","MB","GB","TB"];
        let i = 0;
        while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return n.toFixed(n < 10 ? 1 : 0) + " " + u[i];
    }
    function fmtUptime(s) {
        if (!s) return "—";
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d) return `${d}d ${h}h`;
        if (h) return `${h}h ${m}m`;
        return `${m}m`;
    }

    // ---------- Electron window controls ----------
    function bindWindowControls() {
        $('#winMin')  .addEventListener('click', () => XboxNative.window.minimize());
        $('#winMax')  .addEventListener('click', () => XboxNative.window.maximize());
        $('#winClose').addEventListener('click', () => XboxNative.window.close());
    }

    // ---------- Native bridge: autostart, scan, launch ----------
    function bindNativeBridge() {
        // Autostart toggle
        XboxNative.autostart.get().then(s => {
            $('#toggleAutostart').checked = !!s.openAtLogin;
            $('#autostartStatus').textContent = s.openAtLogin
                ? "Enabled · launches at Windows login"
                : "Disabled";
        });
        $('#toggleAutostart').addEventListener('change', async (e) => {
            const s = await XboxNative.autostart.set(e.target.checked);
            $('#autostartStatus').textContent = s.openAtLogin
                ? "Enabled · launches at Windows login"
                : "Disabled";
            toast("Boot setting saved", s.openAtLogin
                ? "Xbox dashboard will launch on Windows login."
                : "Autostart disabled.");
        });

        // Tray actions push through preload
        XboxNative.on('action', (which) => {
            if (which === 'screenshot') takeNativeScreenshot();
            if (which === 'scan') doNativeScan();
        });

        // System stats loop (when on Tools page)
        setInterval(() => {
            if (state.page === 'tools') refreshStats();
        }, 2000);
        // First load
        XboxNative.systemInfo().then(info => {
            $('#statCpuModel').textContent = (info.cpuModel || "—").replace(/\s+/g, " ").trim();
            $('#statCpuCores').textContent = `${info.cpus} cores · ${info.arch}`;
            $('#statRamTotal').textContent = fmtBytes(info.totalMem);
            $('#statUser').textContent = info.username || "—";
            $('#statHost').textContent = `${info.platform} ${info.release}`;
        });

        // Initial native scan
        doNativeScan({ silent: true });
    }
    function refreshStats() {
        XboxNative.systemStats().then(s => {
            $('#statCpu').textContent = s.cpuPct + "%";
            $('#statCpuBar').style.width = s.cpuPct + "%";
            $('#statMem').textContent = s.memPct + "%";
            $('#statMemBar').style.width = s.memPct + "%";
            $('#statUptime').textContent = fmtUptime(s.uptime);
        });
    }

    async function takeNativeScreenshot() {
        if (!window.XboxNative) {
            toast("Screenshot", "Install the Windows build for native screenshots.");
            return;
        }
        const file = await XboxNative.screenshot();
        if (file) {
            toast("Screenshot saved", file);
            XboxNative.notify && XboxNative.notify("Screenshot saved", file);
        } else {
            toast("Screenshot failed", "Could not capture the screen.");
        }
    }

    async function doNativeScan(opts) {
        opts = opts || {};
        if (!window.XboxNative) return;
        let games;
        try { games = await XboxNative.scanInstalled(); }
        catch (e) { games = []; }
        if (!Array.isArray(games)) games = [];

        // Update counts
        const groups = { xboxapp: 0, uwp: 0, steam: 0, epic: 0 };
        for (const g of games) if (groups[g.source] !== undefined) groups[g.source]++;
        $('#cntXbox').textContent  = groups.xboxapp;
        $('#cntUwp').textContent   = groups.uwp;
        $('#cntSteam').textContent = groups.steam;
        $('#cntEpic').textContent  = groups.epic;

        // Merge into library (preserve existing simulated downloads)
        const existingIds = new Set(state.games.map(g => g.id));
        for (const g of games) {
            const id = `native:${g.id}`;
            if (existingIds.has(id)) continue;
            state.games.push({
                id,
                title: g.title,
                studio: g.source === 'xboxapp' ? 'Xbox app' :
                        g.source === 'uwp'     ? 'Game Pass · UWP' :
                        g.source === 'steam'   ? 'Steam' :
                        g.source === 'epic'    ? 'Epic Games' : g.source,
                size: g.sizeBytes ? Math.round(g.sizeBytes / 1e9) : 0,
                hours: 0,
                state: 'installed',
                native: g,
                art: XboxData.art(g.title.slice(0, 22), '#107C10', '#0d660d', '#9bf76b')
            });
        }
        state.lastScan = nowLabel();
        saveGameOverrides();
        renderLibrary();
        renderHome();

        if (!opts.silent) {
            const total = games.length;
            toast(`Found ${total} installed game${total === 1 ? "" : "s"}`,
                  `Xbox app: ${groups.xboxapp} · UWP: ${groups.uwp} · Steam: ${groups.steam} · Epic: ${groups.epic}`);
            XboxNative.notify && XboxNative.notify("Library scan complete", `${total} installed games found.`);
        }
    }

    // ---------- Tools page ----------
    function renderTools() {
        // Static content already in HTML — just static counts default
        if (!window.XboxNative) {
            $('#cntXbox').textContent = "—";
            $('#cntUwp').textContent  = "—";
            $('#cntSteam').textContent = "—";
            $('#cntEpic').textContent = "—";
            $('#statCpu').textContent = "n/a";
            $('#statMem').textContent = "n/a";
            $('#statUptime').textContent = "n/a";
            $('#statCpuModel').textContent = "Browser sandbox";
            $('#statCpuCores').textContent = (navigator.hardwareConcurrency || "?") + " logical cores";
            $('#statRamTotal').textContent = "n/a";
            $('#statUser').textContent = "Web mode";
            $('#statHost').textContent = navigator.platform || "browser";
        }
    }
    function bindTools() {
        $$('.tool-card[data-tool]').forEach(el => {
            el.addEventListener('click', () => handleToolClick(el.dataset.tool, el));
        });
        $$('.tool-card[data-action]').forEach(el => {
            el.addEventListener('click', () => handleToolAction(el.dataset.action));
        });
    }
    function handleToolClick(tool, el) {
        const label = $('.t-title', el)?.textContent || tool;
        if (window.XboxNative) {
            XboxNative.openTool(tool).then(res => {
                if (res && res.ok) {
                    toast("Launching " + label, "Opening in Windows...");
                } else {
                    toast(label, "Couldn't launch: " + (res && res.reason || "unknown"));
                }
            });
        } else {
            // Web fallback — open the web equivalent
            const webMap = {
                'xbox-app':           'https://www.xbox.com/en-us/apps/xbox-app-for-pc',
                'game-pass':          'https://www.xbox.com/en-US/xbox-game-pass',
                'gp-pc-library':      'https://www.xbox.com/play/library',
                'gp-cloud':           'https://www.xbox.com/play',
                'ms-store':           'https://apps.microsoft.com/',
                'xbox-account':       'https://account.xbox.com/profile',
                'xbox-friends':       'https://account.xbox.com/social',
                'xbox-rewards':       'https://rewards.bing.com/',
                'open-xbox-insider':  'https://www.xbox.com/insider',
                'open-game-pass-quests':'https://www.xbox.com/play/quests',
                'redeem-code':        'https://account.microsoft.com/billing/redeem',
                'game-bar':           'https://support.microsoft.com/topic/d8d03571-c5e0-b2dc-2c0a-c4eee9b1d4f0',
                'capture-folder':     null, 'screenshot-folder': null, 'xbox-captures-folder': null,
                'settings-captures':  null, 'settings-game-bar': null, 'settings-game-mode': null,
                'settings-controller':null, 'task-manager':      null
            };
            const url = webMap[tool];
            if (url) {
                window.open(url, "_blank");
            } else {
                toast(label, "This tool needs the Windows build of Xbox PC.");
            }
        }
    }
    function handleToolAction(action) {
        if (action === 'screenshot')      takeNativeScreenshot();
        else if (action === 'rescan')     window.XboxNative ? doNativeScan() : runScan();
        else if (action === 'fullscreen') {
            if (window.XboxNative) XboxNative.window.fullscreen();
            else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        }
        else if (action === 'quit-to-desktop') {
            if (window.XboxNative) {
                if (confirm("Quit Xbox PC to desktop?")) XboxNative.window.quit();
            } else {
                toast("Quit", "Only available in the Windows build.");
            }
        }
    }
})();
