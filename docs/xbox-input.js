/* Controller + keyboard input → spatial focus navigation.
   Mirrors actual Xbox dashboard input:
     A=select, B=back, X=context, Y=info, Xbox=guide,
     View=captures, Menu=options, LB/RB=tab switch.
*/
(function (global) {
    "use strict";

    const STATE = {
        gamepadIndex: null,
        prevButtons: {},
        prevAxes: [0, 0, 0, 0],
        axisDebounce: 0,
        listeners: {},
        focused: null,
        rumbleSupported: false
    };

    const BUTTONS = {
        A: 0, B: 1, X: 2, Y: 3,
        LB: 4, RB: 5, LT: 6, RT: 7,
        VIEW: 8, MENU: 9,
        LSB: 10, RSB: 11,
        UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
        XBOX: 16
    };

    function on(evt, fn) {
        (STATE.listeners[evt] = STATE.listeners[evt] || []).push(fn);
    }
    function emit(evt, data) {
        (STATE.listeners[evt] || []).forEach(fn => fn(data));
    }

    // ---------- Spatial focus ----------
    function focusables() {
        return Array.from(document.querySelectorAll('[data-focus]')).filter(el => {
            if (el.hasAttribute('hidden') || el.closest('[hidden]')) return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            // Skip elements inside non-active pages
            const page = el.closest('.page');
            if (page && !page.classList.contains('active')) return false;
            // Skip elements inside hidden guide
            const guide = document.getElementById('guide');
            const guideOpen = guide && !guide.hasAttribute('hidden');
            if (el.closest('#guide') && !guideOpen) return false;
            if (!el.closest('#guide') && guideOpen) return false;
            return true;
        });
    }

    function setFocus(el) {
        if (!el) return;
        document.querySelectorAll('.focused').forEach(n => n.classList.remove('focused'));
        el.classList.add('focused');
        STATE.focused = el;
        document.body.classList.add('focus-active');
        try { el.focus({ preventScroll: false }); } catch(e){}
        const rect = el.getBoundingClientRect();
        // Scroll into view but keep some padding
        if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }
        if (rect.left < 260 || rect.right > window.innerWidth - 40) {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        }
    }

    function center(rect) { return { x: rect.left + rect.width/2, y: rect.top + rect.height/2 }; }

    function moveFocus(dir) {
        const els = focusables();
        if (!els.length) return;
        if (!STATE.focused || !els.includes(STATE.focused)) {
            setFocus(els[0]);
            return;
        }
        const from = STATE.focused.getBoundingClientRect();
        const fc = center(from);

        let best = null;
        let bestScore = Infinity;
        for (const el of els) {
            if (el === STATE.focused) continue;
            const r = el.getBoundingClientRect();
            const c = center(r);
            const dx = c.x - fc.x;
            const dy = c.y - fc.y;
            // Direction filter
            if (dir === 'right' && dx <= 4) continue;
            if (dir === 'left'  && dx >= -4) continue;
            if (dir === 'down'  && dy <= 4) continue;
            if (dir === 'up'    && dy >= -4) continue;

            // Distance weighted: heavily prefer same axis
            const major = (dir === 'left' || dir === 'right') ? Math.abs(dx) : Math.abs(dy);
            const minor = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
            const score = major + minor * 2.2;
            if (score < bestScore) { bestScore = score; best = el; }
        }
        if (best) setFocus(best);
    }

    function activate() {
        if (STATE.focused) {
            STATE.focused.click();
        }
    }

    function back() { emit('back'); }
    function context() { emit('context'); }
    function info() { emit('info'); }
    function guide() { emit('guide'); }
    function view() { emit('view'); }
    function menu() { emit('menu'); }
    function tabPrev() { emit('tabPrev'); }
    function tabNext() { emit('tabNext'); }

    // ---------- Keyboard ----------
    document.addEventListener('keydown', (e) => {
        // Don't hijack while typing in inputs
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        switch (e.key) {
            case 'ArrowUp':    case 'w': case 'W': if (!typing) { moveFocus('up');    e.preventDefault(); } break;
            case 'ArrowDown':  case 's': case 'S': if (!typing) { moveFocus('down');  e.preventDefault(); } break;
            case 'ArrowLeft':  case 'a': case 'A': if (!typing) { moveFocus('left');  e.preventDefault(); } break;
            case 'ArrowRight': case 'd': case 'D': if (!typing) { moveFocus('right'); e.preventDefault(); } break;
            case 'Enter':                                          activate(); break;
            case 'Escape':                                         back();     break;
            case 'Backspace':  if (!typing) { back(); e.preventDefault(); } break;
            case 'q': case 'Q': if (!typing) { context(); } break;
            case 'e': case 'E': if (!typing) { info();    } break;
            case ' ':           if (!typing) { guide();   e.preventDefault(); } break;
            case 'Tab':
                if (e.shiftKey) { menu(); } else { view(); }
                e.preventDefault();
                break;
            case '1': if (!typing) { tabPrev(); } break;
            case '2': if (!typing) { tabNext(); } break;
        }
    });

    // ---------- Gamepad ----------
    window.addEventListener('gamepadconnected', (e) => {
        STATE.gamepadIndex = e.gamepad.index;
        STATE.rumbleSupported = !!(e.gamepad.vibrationActuator);
        emit('padconnect', e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
        if (STATE.gamepadIndex === e.gamepad.index) STATE.gamepadIndex = null;
        emit('paddisconnect', e.gamepad);
    });

    function pollGamepad() {
        if (STATE.gamepadIndex === null) {
            requestAnimationFrame(pollGamepad); return;
        }
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads[STATE.gamepadIndex];
        if (!gp) { requestAnimationFrame(pollGamepad); return; }

        // Button edges
        const edge = (idx, fn) => {
            const pressed = gp.buttons[idx] && gp.buttons[idx].pressed;
            const prev = !!STATE.prevButtons[idx];
            if (pressed && !prev) fn();
            STATE.prevButtons[idx] = pressed;
        };

        edge(BUTTONS.A, activate);
        edge(BUTTONS.B, back);
        edge(BUTTONS.X, context);
        edge(BUTTONS.Y, info);
        edge(BUTTONS.XBOX, guide);
        edge(BUTTONS.VIEW, view);
        edge(BUTTONS.MENU, menu);
        edge(BUTTONS.LB, tabPrev);
        edge(BUTTONS.RB, tabNext);
        edge(BUTTONS.UP,    () => moveFocus('up'));
        edge(BUTTONS.DOWN,  () => moveFocus('down'));
        edge(BUTTONS.LEFT,  () => moveFocus('left'));
        edge(BUTTONS.RIGHT, () => moveFocus('right'));

        // Left stick (axes 0,1)
        const ax = gp.axes[0] || 0;
        const ay = gp.axes[1] || 0;
        const TH = 0.55;
        STATE.axisDebounce = Math.max(0, STATE.axisDebounce - 1);
        if (STATE.axisDebounce === 0) {
            if (ax >  TH) { moveFocus('right'); STATE.axisDebounce = 12; }
            else if (ax < -TH) { moveFocus('left');  STATE.axisDebounce = 12; }
            else if (ay >  TH) { moveFocus('down');  STATE.axisDebounce = 12; }
            else if (ay < -TH) { moveFocus('up');    STATE.axisDebounce = 12; }
        }

        requestAnimationFrame(pollGamepad);
    }
    requestAnimationFrame(pollGamepad);

    function rumble(strong, weak, ms) {
        if (STATE.gamepadIndex === null) return Promise.resolve(false);
        const gp = navigator.getGamepads()[STATE.gamepadIndex];
        if (gp && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
            return gp.vibrationActuator.playEffect("dual-rumble", {
                duration: ms || 300, strongMagnitude: strong, weakMagnitude: weak
            }).then(() => true).catch(() => false);
        }
        return Promise.resolve(false);
    }

    function currentPad() {
        if (STATE.gamepadIndex === null) return null;
        return navigator.getGamepads()[STATE.gamepadIndex];
    }

    global.XboxInput = {
        on, focusables, setFocus, moveFocus, activate, back,
        rumble, currentPad,
        BUTTONS
    };
})(window);
