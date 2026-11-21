// Night Shift: The Quiet Vault — the player.
//
// The thief moves with keys or a click target, sneaks on Shift, collects
// shards by walking over them, and is caught when an alerted guard touches
// them. Movement collides against walls and crates with axis separation,
// so the player slides along walls instead of sticking.
import { TILE, onShadow } from "./levels.js";

export const PLAYER_RADIUS = 14;
export const WALK_SPEED = 145;
export const SNEAK_SPEED = 72;

export function createPlayer(spawn) {
  return {
    x: (spawn.x + 0.5) * TILE,
    y: (spawn.y + 0.5) * TILE,
    facing: 0, // radians; 0 faces right
    sneaking: false,
    moving: false,
    stepTimer: 0,
    caught: false,
  };
}

// Try to move the player by (dx, dy), axis by axis, against solid tiles.
export function movePlayer(player, dx, dy, isSolid) {
  const r = PLAYER_RADIUS;
  const nx = player.x + dx;
  if (!circleHitsSolid(nx, player.y, r, isSolid)) player.x = nx;
  const ny = player.y + dy;
  if (!circleHitsSolid(player.x, ny, r, isSolid)) player.y = ny;
}

export function circleHitsSolid(cx, cy, r, isSolid) {
  const x0 = Math.floor((cx - r) / TILE);
  const x1 = Math.floor((cx + r) / TILE);
  const y0 = Math.floor((cy - r) / TILE);
  const y1 = Math.floor((cy + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolid(tx, ty)) continue;
      // Closest point of the tile to the circle centre.
      const px = Math.max(tx * TILE, Math.min(cx, (tx + 1) * TILE));
      const py = Math.max(ty * TILE, Math.min(cy, (ty + 1) * TILE));
      const ddx = cx - px;
      const ddy = cy - py;
      if (ddx * ddx + ddy * ddy < r * r) return true;
    }
  }
  return false;
}

// One frame of player movement. Returns the distance moved this frame.
export function updatePlayer(player, input, dt, isSolid, audio) {
  let vx = 0;
  let vy = 0;
  const [kx, ky] = input.moveVector();
  if (kx !== 0 || ky !== 0) {
    vx = kx;
    vy = ky;
  } else if (input.target) {
    const dx = input.target.x - player.x;
    const dy = input.target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      input.clearTarget();
    } else {
      vx = dx / dist;
      vy = dy / dist;
    }
  }
  player.sneaking = input.sneaking;
  player.moving = vx !== 0 || vy !== 0;
  if (player.moving) {
    const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const step = speed * dt;
    movePlayer(player, vx * step, vy * step, isSolid);
    player.facing = Math.atan2(vy, vx);
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      audio.step(player.sneaking);
      player.stepTimer = player.sneaking ? 0.55 : 0.34;
    }
    return step;
  }
  return 0;
}

// Is the player standing in shadow right now? (Guards spot them slower.)
export function playerInShadow(parsed, player) {
  return onShadow(parsed, player.x, player.y);
}

// Pick up any shard the player is touching. Returns the shards taken.
export function collectShards(player, shards) {
  const taken = [];
  for (const shard of shards) {
    if (shard.taken) continue;
    const cx = (shard.x + 0.5) * TILE;
    const cy = (shard.y + 0.5) * TILE;
    if (Math.hypot(player.x - cx, player.y - cy) < PLAYER_RADIUS + 16) {
      shard.taken = true;
      taken.push(shard);
    }
  }
  return taken;
}

// Has the player reached the exit tile?
export function atExit(player, exit) {
  const cx = (exit.x + 0.5) * TILE;
  const cy = (exit.y + 0.5) * TILE;
  return Math.hypot(player.x - cx, player.y - cy) < PLAYER_RADIUS + 18;
}
