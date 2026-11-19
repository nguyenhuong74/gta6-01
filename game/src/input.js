// Keyboard + mouse input: held keys, pressed-this-frame edges, and the mouse
// position in screen space (converted to world space by the caller).
export const ACTION = {
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right',
  RUN: 'run', ENTER_CAR: 'enter', ATTACK: 'attack', INTERACT: 'interact',
  PAUSE: 'pause', MUTE: 'mute', RELOAD: 'reload', CONFIRM: 'confirm',
};

const KEY_MAP = {
  KeyW: ACTION.UP, ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN, ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT, ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT, ArrowRight: ACTION.RIGHT,
  ShiftLeft: ACTION.RUN, ShiftRight: ACTION.RUN,
  KeyE: ACTION.ENTER_CAR,
  KeyF: ACTION.INTERACT,
  KeyR: ACTION.RELOAD,
  KeyM: ACTION.MUTE,
  Enter: ACTION.CONFIRM,
  Escape: ACTION.PAUSE, KeyP: ACTION.PAUSE,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    const a = KEY_MAP[e.code];
    if (a) {
      if (!held.has(a)) pressed.add(a);
      held.add(a);
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const a = KEY_MAP[e.code];
    if (a) held.delete(a);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    isDown(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    // Movement vector from WASD/arrows, normalised.
    moveVector() {
      let x = 0, y = 0;
      if (held.has(ACTION.LEFT)) x -= 1;
      if (held.has(ACTION.RIGHT)) x += 1;
      if (held.has(ACTION.UP)) y -= 1;
      if (held.has(ACTION.DOWN)) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
