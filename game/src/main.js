// Night Shift: The Quiet Vault — bootstrap, game loop and screens.
//
// One thief, three museum wings, guards with real vision cones. Grab every
// shard, then reach the green exit unseen. Getting caught costs a life;
// losing all three ends the run.
import { LEVELS, parseLevel, makeSolidChecker, makeSightChecker } from "./levels.js";
import { createPlayer, updatePlayer, collectShards, atExit, playerInShadow } from "./player.js";
import { createGuard, updateGuard, GUARD_RADIUS } from "./guard.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { render } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ov-title");
const ovSub = document.getElementById("ov-sub");
const ovBody = document.getElementById("ov-body");
const ovButton = document.getElementById("ov-button");
const ovHint = document.getElementById("ov-hint");
const hudLevel = document.getElementById("hud-level");
const hudShards = document.getElementById("hud-shards");
const hudLives = document.getElementById("hud-lives");
const hudTime = document.getElementById("hud-time");
const eyeFill = document.getElementById("eye-fill");
const eyeLabel = document.getElementById("eye-label");

const input = createInput(canvas);
const audio = createAudio();

// --- run state -------------------------------------------------------------
const run = {
  screen: "title", // title | playing | paused | levelDone | gameOver | victory
  levelIndex: 0,
  lives: 3,
  score: 0,
  time: 0,
  levelTime: 0,
  everAlerted: false, // any guard reached alert in this level
  parsed: null,
  player: null,
  guards: [],
  exitOpen: false,
  isSolid: null,
  isSightSolid: null,
  shardsTotal: 0,
};

function loadLevel(index) {
  const def = LEVELS[index];
  const parsed = parseLevel(def);
  run.parsed = parsed;
  run.player = createPlayer(parsed.playerSpawn);
  run.guards = def.guards.map(createGuard);
  run.exitOpen = false;
  run.levelTime = 0;
  run.everAlerted = false;
  run.isSolid = makeSolidChecker(parsed);
  run.isSightSolid = makeSightChecker(parsed);
  run.shardsTotal = parsed.shards.length;
  hudLevel.textContent = `Level ${index + 1}/3 · ${def.name}`;
}

function showOverlay(title, sub, bodyHtml, buttonLabel, hintHtml) {
  ovTitle.textContent = title;
  ovSub.textContent = sub;
  ovBody.innerHTML = bodyHtml;
  ovButton.textContent = buttonLabel;
  ovHint.innerHTML = hintHtml || "";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startRun() {
  audio.unlock();
  run.levelIndex = 0;
  run.lives = 3;
  run.score = 0;
  run.time = 0;
  loadLevel(0);
  run.screen = "playing";
  hideOverlay();
}

function nextLevel() {
  run.levelIndex += 1;
  if (run.levelIndex >= LEVELS.length) {
    run.screen = "victory";
    audio.win();
    showOverlay(
      "CLEAN GETAWAY",
      "All three wings cleared",
      `<p>You slipped out of every wing unseen.<br>Final score: <b>${run.score}</b> · Time: <b>${formatTime(run.time)}</b></p>`,
      "Play again",
      "Three wings, three quiet exits. The vault never knew you were there.",
    );
    return;
  }
  loadLevel(run.levelIndex);
  run.screen = "playing";
  hideOverlay();
}

function levelComplete() {
  const timeBonus = Math.max(0, Math.round(300 - run.levelTime));
  const ghostBonus = run.everAlerted ? 0 : 150;
  const gained = 250 + timeBonus + ghostBonus;
  run.score += gained;
  audio.exitOpen();
  run.screen = "levelDone";
  const last = run.levelIndex >= LEVELS.length - 1;
  showOverlay(
    last ? "WING CLEARED" : "WING CLEARED",
    LEVELS[run.levelIndex].name,
    `<p>Out clean. <b>+${gained}</b> points (clear 250 + time ${timeBonus}` +
      (ghostBonus ? " + ghost 150 — never spotted" : " — spotted once, no ghost bonus") +
      `).<br>Score: <b>${run.score}</b></p>`,
    last ? "See the getaway" : "Enter the next wing",
    last ? "" : LEVELS[run.levelIndex + 1].intro,
  );
}

function caught() {
  run.lives -= 1;
  audio.caught();
  run.player.caught = true;
  if (run.lives <= 0) {
    run.screen = "gameOver";
    audio.lose();
    showOverlay(
      "CAUGHT",
      "The alarm gave you away",
      `<p>The guards closed in on the ${LEVELS[run.levelIndex].name}.<br>Score: <b>${run.score}</b> · Reached level ${run.levelIndex + 1} of 3.</p>`,
      "Try again",
      "Watch the patrols, wait for the gap, and move in shadow.",
    );
    return;
  }
  // Lose a life and restart the wing from its entrance; shards stay taken.
  const keptShards = run.parsed.shards.filter((s) => s.taken);
  loadLevel(run.levelIndex);
  for (const shard of run.parsed.shards) {
    if (keptShards.some((k) => k.x === shard.x && k.y === shard.y)) shard.taken = true;
  }
  run.screen = "playing";
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateHud() {
  const taken = run.parsed ? run.parsed.shards.filter((s) => s.taken).length : 0;
  hudShards.textContent = `Shards ${taken}/${run.shardsTotal}`;
  hudLives.textContent = `Lives ${"♥".repeat(Math.max(0, run.lives))}${"♡".repeat(Math.max(0, 3 - run.lives))}`;
  hudTime.textContent = formatTime(run.time);
  const detection = run.guards.length
    ? Math.max(...run.guards.map((g) => g.suspicion))
    : 0;
  eyeFill.style.width = `${detection}%`;
  if (detection >= 100 || run.guards.some((g) => g.state === "alert")) {
    eyeFill.style.background = "#ff5a5a";
    eyeLabel.textContent = "SPOTTED";
    eyeLabel.style.color = "#ff5a5a";
  } else if (detection >= 35) {
    eyeFill.style.background = "#ffb020";
    eyeLabel.textContent = "SUSPICIOUS";
    eyeLabel.style.color = "#ffb020";
  } else {
    eyeFill.style.background = "#7ee081";
    eyeLabel.textContent = "UNSEEN";
    eyeLabel.style.color = "#7ee081";
  }
}

// --- main loop ---------------------------------------------------------------
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (run.screen === "playing" && run.player) {
    run.time += dt;
    run.levelTime += dt;
    const inShadow = playerInShadow(run.parsed, run.player);
    updatePlayer(run.player, input, dt, run.isSolid, audio);

    // When one guard raises the alarm, nearby guards get suspicious too.
    const onAlert = (alerter) => {
      run.everAlerted = true;
      for (const other of run.guards) {
        if (other === alerter) continue;
        const d = Math.hypot(other.x - alerter.x, other.y - alerter.y);
        if (d < 340) other.suspicion = Math.max(other.suspicion, 60);
      }
    };
    for (const guard of run.guards) {
      guard.justAlerted = false;
      updateGuard(guard, {
        isSolid: run.isSolid,
        isSightSolid: run.isSightSolid,
        player: run.player,
        inShadow,
        dt,
        audio,
        onAlert,
      });
    }

    const taken = collectShards(run.player, run.parsed.shards);
    if (taken.length > 0) {
      audio.pickup();
      run.score += 100 * taken.length;
    }
    if (!run.exitOpen && run.parsed.shards.every((s) => s.taken)) {
      run.exitOpen = true;
      audio.exitOpen();
    }
    if (run.exitOpen && atExit(run.player, run.parsed.exit)) {
      levelComplete();
    }

    // Caught: an alerted guard touches the thief.
    for (const guard of run.guards) {
      if (guard.state !== "alert") continue;
      const d = Math.hypot(guard.x - run.player.x, guard.y - run.player.y);
      if (d < GUARD_RADIUS + 14) {
        caught();
        break;
      }
    }
    updateHud();
  }

  if (run.player) {
    render(ctx, {
      parsed: run.parsed,
      guards: run.guards,
      player: run.player,
      shards: run.parsed.shards,
      exit: run.parsed.exit,
      exitOpen: run.exitOpen,
      clickTarget: input.target,
      isSightSolid: run.isSightSolid,
    }, now / 1000);
  }
  requestAnimationFrame(frame);
}

// --- wiring ------------------------------------------------------------------
ovButton.addEventListener("click", () => {
  audio.unlock();
  if (run.screen === "title" || run.screen === "gameOver" || run.screen === "victory") {
    startRun();
  } else if (run.screen === "levelDone") {
    nextLevel();
  }
});

input.onPause = () => {
  if (run.screen === "playing") {
    run.screen = "paused";
    showOverlay("PAUSED", LEVELS[run.levelIndex].name, "<p>Take a breath. The guards are waiting.</p>", "Resume", "P resumes · M mutes");
    ovButton.textContent = "Resume";
    ovButton.onclick = () => {
      run.screen = "playing";
      hideOverlay();
      ovButton.onclick = null;
    };
  } else if (run.screen === "paused") {
    run.screen = "playing";
    hideOverlay();
  }
};

input.onMute = () => {
  const muted = audio.toggleMute();
  ovHint.textContent = muted ? "Sound muted (M to unmute)" : "";
};

// Title screen on load; a first level is rendered behind it.
loadLevel(0);
showOverlay(
  "NIGHT SHIFT",
  "The Quiet Vault",
  "<p>You are the thief the museum never sees. Three wings, three sets of " +
    "patrols, one quiet exit each.<br>Learn the routes. Wait for the gaps. " +
    "Take every shard — the green door only opens when you do.</p>",
  "Start the heist",
  "WASD / arrows to move · Shift to sneak · click to walk there<br>" +
    "Grab every shard, then slip out the green exit — unseen.",
);
requestAnimationFrame(frame);

// Test hook for headless play-testing: drive the game without a mouse.
window.__stealth = {
  get screen() { return run.screen; },
  get level() { return run.levelIndex + 1; },
  get lives() { return run.lives; },
  get score() { return run.score; },
  get shardsTaken() { return run.parsed.shards.filter((s) => s.taken).length; },
  get shardsTotal() { return run.shardsTotal; },
  get exitOpen() { return run.exitOpen; },
  get detection() { return run.guards.length ? Math.max(...run.guards.map((g) => g.suspicion)) : 0; },
  get guardStates() { return run.guards.map((g) => g.state); },
  playerPos() { return { x: run.player.x, y: run.player.y }; },
  start() { startRun(); },
  teleport(tileX, tileY) {
    run.player.x = (tileX + 0.5) * 48;
    run.player.y = (tileY + 0.5) * 48;
    input.clearTarget();
  },
};
