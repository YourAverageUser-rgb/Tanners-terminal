/* Mock data for the Xbox PC dashboard. Persists to localStorage. */
(function (global) {
    "use strict";

    // SVG-based "box art" generator so we don't depend on external assets.
    function art(label, c1, c2, accent) {
        const svg =
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'>` +
            `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
            `<stop offset='0%' stop-color='${c1}'/>` +
            `<stop offset='100%' stop-color='${c2}'/></linearGradient></defs>` +
            `<rect width='300' height='400' fill='url(#g)'/>` +
            `<circle cx='240' cy='60' r='40' fill='${accent}' opacity='0.35'/>` +
            `<rect x='-20' y='280' width='350' height='120' fill='${accent}' opacity='0.2' transform='rotate(-8 150 320)'/>` +
            `<text x='20' y='350' fill='white' font-family='Segoe UI, sans-serif' font-size='28' font-weight='700'>${label}</text>` +
            `</svg>`;
        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    // ---------- Games library ----------
    const baseGames = [
        { id: "fh5",       title: "Forza Horizon 5",            studio: "Playground Games", size: 116, hours: 38, state: "installed",   art: art("Forza Horizon 5", "#7c3aed", "#312e81", "#a78bfa") },
        { id: "fh6",       title: "Forza Horizon 6",            studio: "Playground Games", size: 134, hours: 0,  state: "downloading", progress: 42, eta: "12 min left", art: art("Forza Horizon 6", "#0ea5e9", "#0c4a6e", "#7dd3fc") },
        { id: "halo",      title: "Halo Infinite",              studio: "343 Industries",   size: 78,  hours: 64, state: "installed",   art: art("Halo Infinite", "#1e3a8a", "#0c1e54", "#60a5fa") },
        { id: "gears5",    title: "Gears 5",                    studio: "The Coalition",    size: 62,  hours: 22, state: "installed",   art: art("Gears 5", "#7f1d1d", "#1c1917", "#f87171") },
        { id: "sot",       title: "Sea of Thieves",             studio: "Rare",             size: 52,  hours: 41, state: "installed",   art: art("Sea of Thieves", "#0c4a6e", "#082f49", "#22d3ee") },
        { id: "msfs",      title: "Flight Simulator 2024",      studio: "Asobo Studio",     size: 142, hours: 0,  state: "downloading", progress: 18, eta: "1h 4m left", art: art("Flight Sim 2024", "#0369a1", "#0b132b", "#67e8f9") },
        { id: "starfield", title: "Starfield",                  studio: "Bethesda",         size: 124, hours: 88, state: "installed",   art: art("Starfield", "#0b132b", "#000814", "#fde047") },
        { id: "mc",        title: "Minecraft",                  studio: "Mojang",           size: 4,   hours: 210, state: "installed",  art: art("Minecraft", "#166534", "#052e16", "#86efac") },
        { id: "cod",       title: "Call of Duty: Black Ops 6",  studio: "Treyarch",         size: 198, hours: 12, state: "installed",   art: art("Black Ops 6", "#3f3f46", "#18181b", "#fbbf24") },
        { id: "fallout76", title: "Fallout 76",                 studio: "Bethesda",         size: 0,   hours: 6,  state: "cloud",       art: art("Fallout 76", "#92400e", "#451a03", "#fde68a") },
        { id: "hellblade", title: "Senua's Saga: Hellblade II", studio: "Ninja Theory",     size: 70,  hours: 14, state: "installed",   art: art("Hellblade II", "#374151", "#111827", "#a78bfa") },
        { id: "avowed",    title: "Avowed",                     studio: "Obsidian",         size: 80,  hours: 0,  state: "downloading", progress: 71, eta: "4 min left", art: art("Avowed", "#5b21b6", "#1e1b4b", "#c4b5fd") },
        { id: "som",       title: "South of Midnight",          studio: "Compulsion Games", size: 0,   hours: 3,  state: "cloud",       art: art("South of Midnight", "#7c2d12", "#1c0a02", "#fda4af") },
        { id: "indy",      title: "Indiana Jones & TGC",        studio: "MachineGames",     size: 92,  hours: 28, state: "installed",   art: art("Indiana Jones", "#854d0e", "#1c1917", "#fde68a") },
        { id: "fable",     title: "Fable",                      studio: "Playground Games", size: 0,   hours: 0,  state: "ready",       art: art("Fable", "#365314", "#0f1d04", "#bef264") },
        { id: "outerw2",   title: "The Outer Worlds 2",         studio: "Obsidian",         size: 0,   hours: 0,  state: "ready",       art: art("Outer Worlds 2", "#0f766e", "#0b302d", "#5eead4") }
    ];

    const storeGames = [
        { id: "doom",      title: "DOOM: The Dark Ages",        price: "Game Pass",         art: art("DOOM Dark Ages", "#7f1d1d", "#1c0a0a", "#fca5a5") },
        { id: "perfect",   title: "Perfect Dark",               price: "Game Pass",         art: art("Perfect Dark", "#1f2937", "#0b0f1a", "#67e8f9") },
        { id: "stalker2",  title: "S.T.A.L.K.E.R. 2",           price: "$59.99",            art: art("STALKER 2", "#4b5563", "#1f2937", "#fbbf24") },
        { id: "diii",      title: "Diablo IV: Vessel of Hate",  price: "$39.99",            art: art("Diablo IV VoH", "#7f1d1d", "#0c0a09", "#dc2626") },
        { id: "elderring", title: "Elden Ring Nightreign",      price: "$39.99",            art: art("Elden Ring NR", "#713f12", "#1c1102", "#fde68a") },
        { id: "ac",        title: "Assassin's Creed Shadows",   price: "$69.99",            art: art("AC Shadows", "#0c0a09", "#0c0a09", "#dc2626") }
    ];

    const gamepassRecent = [
        { id: "indy2",  title: "Indiana Jones & TGC", state: "ready",   art: art("Indiana Jones", "#854d0e", "#1c1917", "#fde68a") },
        { id: "avowed2",title: "Avowed",              state: "ready",   art: art("Avowed", "#5b21b6", "#1e1b4b", "#c4b5fd") },
        { id: "som2",   title: "South of Midnight",   state: "ready",   art: art("South of Midnight", "#7c2d12", "#1c0a02", "#fda4af") },
        { id: "fable2", title: "Fable",               state: "ready",   art: art("Fable", "#365314", "#0f1d04", "#bef264") }
    ];

    const cloudGames = [
        { id: "fh5c",   title: "Forza Horizon 5",  art: art("FH5 ☁", "#7c3aed", "#312e81", "#a78bfa") },
        { id: "haloc",  title: "Halo Infinite",    art: art("Halo ☁", "#1e3a8a", "#0c1e54", "#60a5fa") },
        { id: "sotc",   title: "Sea of Thieves",   art: art("SoT ☁", "#0c4a6e", "#082f49", "#22d3ee") },
        { id: "fo76c",  title: "Fallout 76",       art: art("FO76 ☁", "#92400e", "#451a03", "#fde68a") },
        { id: "somc",   title: "South of Midnight",art: art("SoM ☁", "#7c2d12", "#1c0a02", "#fda4af") }
    ];

    // ---------- Friends ----------
    const friends = [
        { gt: "ShadowFox42",      status: "ingame", game: "Halo Infinite",       avatar: "S" },
        { gt: "PixelPanda",       status: "online", game: "Home",                avatar: "P" },
        { gt: "NightOwl_99",      status: "party",  game: "Sea of Thieves",      avatar: "N" },
        { gt: "VelvetGhost",      status: "ingame", game: "Forza Horizon 5",     avatar: "V" },
        { gt: "EmberWolf",        status: "online", game: "Microsoft Store",     avatar: "E" },
        { gt: "QuantumLeap",      status: "ingame", game: "Starfield",           avatar: "Q" },
        { gt: "Mr.Drift",         status: "ingame", game: "Forza Horizon 5",     avatar: "M" },
        { gt: "CinderBee",        status: "offline",game: "Last on yesterday",   avatar: "C" },
        { gt: "Atlas_VII",        status: "online", game: "Looking for game",    avatar: "A" },
        { gt: "RogueCarbon",      status: "ingame", game: "Black Ops 6",         avatar: "R" },
        { gt: "Lunar_Tea",        status: "party",  game: "Minecraft",           avatar: "L" },
        { gt: "ZeroHorizon",      status: "offline",game: "Last on 3d ago",      avatar: "Z" }
    ];

    // ---------- Messages ----------
    const messages = [
        {
            id: "m1", with: "ShadowFox42", avatar: "S", unread: true,
            preview: "wanna squad up?",
            time: "now",
            thread: [
                { from: "ShadowFox42", text: "yo", at: "9:14 PM" },
                { from: "ShadowFox42", text: "wanna squad up?", at: "9:14 PM" }
            ]
        },
        {
            id: "m2", with: "NightOwl_99", avatar: "N", unread: true,
            preview: "I sent you a party invite",
            time: "5m",
            thread: [
                { from: "me", text: "you on tonight?", at: "8:50 PM" },
                { from: "NightOwl_99", text: "yeah just got home", at: "8:55 PM" },
                { from: "NightOwl_99", text: "I sent you a party invite", at: "9:09 PM" }
            ]
        },
        {
            id: "m3", with: "VelvetGhost", avatar: "V", unread: true,
            preview: "GG that last race was wild",
            time: "1h",
            thread: [
                { from: "me", text: "no way you caught me on that last lap", at: "8:00 PM" },
                { from: "VelvetGhost", text: "GG that last race was wild", at: "8:05 PM" }
            ]
        },
        {
            id: "m4", with: "PixelPanda", avatar: "P", unread: false,
            preview: "thx for the carry",
            time: "3h",
            thread: [
                { from: "PixelPanda", text: "thx for the carry", at: "6:32 PM" },
                { from: "me", text: "anytime 🤝", at: "6:33 PM" }
            ]
        },
        {
            id: "m5", with: "Mr.Drift", avatar: "M", unread: false,
            preview: "tournament saturday?",
            time: "yesterday",
            thread: [
                { from: "Mr.Drift", text: "tournament saturday?", at: "Yesterday, 10:14 AM" }
            ]
        }
    ];

    // ---------- Achievements ----------
    const achievements = [
        { game: "Halo Infinite",       title: "Headmaster",          desc: "Get 50 headshots in multiplayer.",       gs: 30,  unlocked: true,  recent: true },
        { game: "Forza Horizon 5",     title: "Drifter's High",      desc: "Earn 1,000,000 drift points.",            gs: 20,  unlocked: true,  recent: true },
        { game: "Starfield",           title: "One Small Step",      desc: "Complete the first mission.",             gs: 50,  unlocked: true,  recent: true },
        { game: "Sea of Thieves",      title: "Captain at Last",     desc: "Buy your own ship.",                       gs: 25,  unlocked: true,  recent: false },
        { game: "Gears 5",             title: "Take Out the Trash",  desc: "Defeat a Swarm Berserker.",                gs: 15,  unlocked: false, recent: false },
        { game: "Minecraft",           title: "When Pigs Fly",       desc: "Fly a pig off a cliff.",                   gs: 40,  unlocked: true,  recent: false },
        { game: "Hellblade II",        title: "Voices in the Dark",  desc: "Survive the first vision.",                gs: 35,  unlocked: false, recent: false },
        { game: "Indiana Jones",       title: "Holy Grail",          desc: "Recover an ancient relic.",                gs: 45,  unlocked: true,  recent: true }
    ];

    // ---------- Captures ----------
    const captures = [
        { label: "Forza Horizon 5 · screenshot", c1: "#7c3aed", c2: "#312e81" },
        { label: "Halo Infinite · clip 30s",     c1: "#1e3a8a", c2: "#0c1e54" },
        { label: "Starfield · screenshot",       c1: "#0b132b", c2: "#000814" },
        { label: "Sea of Thieves · clip 15s",    c1: "#0c4a6e", c2: "#082f49" },
        { label: "Minecraft · screenshot",       c1: "#166534", c2: "#052e16" },
        { label: "Gears 5 · clip 1m",            c1: "#7f1d1d", c2: "#1c1917" }
    ];

    global.XboxData = {
        baseGames,
        storeGames,
        gamepassRecent,
        cloudGames,
        friends,
        messages,
        achievements,
        captures,
        art
    };

})(window);
