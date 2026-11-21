// Night Shift: The Quiet Vault — keyboard and mouse input.
//
// WASD / arrows move, Shift sneaks (slower, harder to spot), click sets a
// walk target, P pauses, M mutes. The game reads this state once per frame.
export function createInput(canvas) {
  const keys = new Set();
  let clickTarget = null;

  const KEYMAP = {
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
    ShiftLeft: "sneak", ShiftRight: "sneak",
  };

  function onKeyDown(e) {
    if (e.code === "KeyP") { input.onPause?.(); return; }
    if (e.code === "KeyM") { input.onMute?.(); return; }
    const action = KEYMAP[e.code];
    if (action) {
      keys.add(action);
      clickTarget = null; // keys override a click target
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("click", onClick);

  const input = {
    onPause: null,
    onMute: null,
    // Unit movement vector from the held keys, or [0, 0].
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has("left")) x -= 1;
      if (keys.has("right")) x += 1;
      if (keys.has("up")) y -= 1;
      if (keys.has("down")) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return [x, y];
    },
    get sneaking() {
      return keys.has("sneak");
    },
    get hasKeys() {
      return keys.size > 0;
    },
    get target() {
      return clickTarget;
    },
    clearTarget() {
      clickTarget = null;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("click", onClick);
    },
  };
  return input;
}
