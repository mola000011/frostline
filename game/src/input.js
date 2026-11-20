// Keyboard input: held keys steer, one-shot presses queue as actions.
// WASD/arrows drive and walk, E enter/exit car, Space handbrake or shoot,
// R radio, M missions, G interact, P/Esc pause, X sound, 1-3 save slots.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_INTERACT = 4;
export const ACT_RADIO = 8;
export const ACT_MISSIONS = 16;
export const ACT_SHOOT = 32;
export const ACT_SOUND = 64;
export const ACT_TITLE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE', 'KeyG']);
const RADIO = new Set(['KeyR']);
const MISSIONS = new Set(['KeyM']);
const SHOOT = new Set(['Space']);
const SOUND = new Set(['KeyX']);
const DIGITS = new Set(['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8']);
const TITLE_KEY = new Set(['KeyT']);

export function createInput() {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let digit = null;

  function onKeyDown(event) {
    if (UP.has(event.code)) { up = true; event.preventDefault(); return; }
    if (DOWN.has(event.code)) { down = true; event.preventDefault(); return; }
    if (LEFT.has(event.code)) { left = true; event.preventDefault(); return; }
    if (RIGHT.has(event.code)) { right = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACT_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACT_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACT_INTERACT;
    else if (RADIO.has(event.code)) actions |= ACT_RADIO;
    else if (MISSIONS.has(event.code)) actions |= ACT_MISSIONS;
    else if (SHOOT.has(event.code)) { actions |= ACT_SHOOT; event.preventDefault(); }
    else if (SOUND.has(event.code)) actions |= ACT_SOUND;
    else if (TITLE_KEY.has(event.code)) actions |= ACT_TITLE;
    else if (DIGITS.has(event.code)) digit = Number(event.code.slice(5));
    else return;
    event.preventDefault();
  }
  function onKeyUp(event) {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  }
  function onBlur() {
    up = false; down = false; left = false; right = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    // Steering: -1..1 for throttle (up positive) and turn (right positive).
    throttle() { return (up ? 1 : 0) - (down ? 1 : 0); },
    steer() { return (right ? 1 : 0) - (left ? 1 : 0); },
    held() { return up || down || left || right; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeDigit() {
      const d = digit;
      digit = null;
      return d;
    },
    // Used by menus: a key pressed this frame, as its code, or ''.
    consumeKey() { return ''; },
  };
}
