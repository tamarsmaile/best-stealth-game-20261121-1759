// Night Shift: The Quiet Vault — canvas rendering.
//
// Top-down night museum: dark floor, yellow vision cones clipped by walls,
// crates as cover, shadow patches, a glowing exit. Everything is drawn
// with canvas paths — no images, no fonts, no network.
import { TILE, COLS, ROWS } from "./levels.js";
import { guardConePoints } from "./guard.js";

const FLOOR_A = "#1b2142";
const FLOOR_B = "#1e2547";
const SHADOW_FLOOR = "#11162c";
const WALL_FILL = "#3a4364";
const WALL_TOP = "#4c587e";
const CRATE_FILL = "#6b4f2a";
const CRATE_EDGE = "#8a6a3b";

function tileCenter(tile) {
  return { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
}

function drawFloor(ctx, parsed) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  for (const [x, y] of parsed.shadows) {
    ctx.fillStyle = SHADOW_FLOOR;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    // Diagonal hatch so shadow reads at a glance, even shrunk.
    ctx.strokeStyle = "rgba(140, 160, 220, 0.13)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x * TILE + 8, y * TILE + TILE - 8);
    ctx.lineTo(x * TILE + TILE - 8, y * TILE + 8);
    ctx.moveTo(x * TILE + 2, y * TILE + TILE - 2);
    ctx.lineTo(x * TILE + TILE - 2, y * TILE + 2);
    ctx.stroke();
  }
  // Faint tile grid.
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, ROWS * TILE);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(COLS * TILE, y * TILE);
  }
  ctx.stroke();
}

function drawWallsAndCrates(ctx, parsed) {
  for (const [x, y] of parsed.walls) {
    ctx.fillStyle = WALL_FILL;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(x * TILE, y * TILE, TILE, 6);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
  }
  for (const [x, y] of parsed.crates) {
    const px = x * TILE;
    const py = y * TILE;
    ctx.fillStyle = CRATE_FILL;
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = CRATE_EDGE;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + TILE - 3, py + TILE - 3);
    ctx.moveTo(px + TILE - 3, py + 3);
    ctx.lineTo(px + 3, py + TILE - 3);
    ctx.stroke();
  }
}

function drawShards(ctx, shards, time) {
  for (const shard of shards) {
    if (shard.taken) continue;
    const { x, y } = tileCenter(shard);
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + shard.x);
    const r = 11 * pulse;
    ctx.save();
    ctx.shadowColor = "#ffd166";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.7, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, exit, open, time) {
  const { x, y } = tileCenter(exit);
  const glow = open ? 0.65 + 0.35 * Math.sin(time * 4) : 0.25;
  ctx.save();
  ctx.shadowColor = open ? "#2fbf71" : "#c94f4f";
  ctx.shadowBlur = 18 * glow + 4;
  ctx.fillStyle = open ? "#2fbf71" : "#7a3b3b";
  ctx.fillRect(x - 20, y - 20, 40, 40);
  ctx.restore();
  ctx.strokeStyle = open ? "#a7f3c7" : "#d8a0a0";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 20, y - 20, 40, 40);
  ctx.fillStyle = "#0b0e1a";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(open ? "EXIT" : "LOCK", x, y);
}

function drawCones(ctx, guards, isSightSolid) {
  for (const guard of guards) {
    const pts = guardConePoints(guard, isSightSolid);
    let fill = "rgba(255, 209, 102, 0.32)";
    if (guard.state === "suspicious") fill = "rgba(255, 166, 66, 0.40)";
    if (guard.state === "alert" || guard.state === "search") fill = "rgba(229, 72, 77, 0.42)";
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGuards(ctx, guards) {
  for (const guard of guards) {
    // Body: a red watchman with a facing tick.
    ctx.fillStyle = "#e5484d";
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a1f22";
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
    ctx.stroke();
    // State mark above the head.
    if (guard.state === "suspicious" || guard.state === "search") {
      ctx.fillStyle = "#ffb020";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("?", guard.x, guard.y - 18);
    } else if (guard.state === "alert") {
      ctx.fillStyle = "#ff5a5a";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("!", guard.x, guard.y - 18);
    }
    // Suspicion ring: fills as the guard grows sure of you.
    if (guard.suspicion > 3) {
      ctx.strokeStyle = guard.suspicion >= 100 ? "#ff5a5a" : "#ffb020";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx, player) {
  const r = player.sneaking ? 12 : 14;
  ctx.fillStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.arc(player.x, player.y, r - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ccfbf1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.facing) * (r + 6), player.y + Math.sin(player.facing) * (r + 6));
  ctx.stroke();
  if (player.sneaking) {
    ctx.strokeStyle = "rgba(45, 212, 191, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawClickTarget(ctx, target) {
  if (!target) return;
  ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(target.x - 13, target.y);
  ctx.lineTo(target.x + 13, target.y);
  ctx.moveTo(target.x, target.y - 13);
  ctx.lineTo(target.x, target.y + 13);
  ctx.stroke();
}

// Night vignette: the room is dark away from the player, so the light
// radius around the thief reads as the safe bubble.
function drawVignette(ctx, player) {
  const grad = ctx.createRadialGradient(
    player.x, player.y, 90,
    player.x, player.y, 520,
  );
  grad.addColorStop(0, "rgba(5, 7, 16, 0)");
  grad.addColorStop(1, "rgba(5, 7, 16, 0.42)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
}

export function render(ctx, world, time) {
  const { parsed, guards, player, shards, exit, exitOpen, clickTarget, isSightSolid } = world;
  ctx.clearRect(0, 0, COLS * TILE, ROWS * TILE);
  drawFloor(ctx, parsed);
  // Night falls on the floor first: cones, guards and the thief stay bright
  // on top of it, so the vision cones read yellow at a glance.
  drawVignette(ctx, player);
  drawExit(ctx, exit, exitOpen, time);
  drawShards(ctx, shards, time);
  drawCones(ctx, guards, isSightSolid);
  drawWallsAndCrates(ctx, parsed);
  drawGuards(ctx, guards);
  drawPlayer(ctx, player);
  drawClickTarget(ctx, clickTarget);
}
