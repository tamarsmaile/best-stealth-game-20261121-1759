// Night Shift: The Quiet Vault — guard AI.
//
// A guard patrols waypoints, watches a vision cone, and works through four
// states: patrol, suspicious (something moved), alert (chase) and search
// (lost you, checks where you were last seen). Sight is a real line-of-
// sight test: walls and crates block it, shadow and sneaking slow it.
import { TILE } from "./levels.js";

export const GUARD_RADIUS = 14;
export const VISION_RANGE = 235;
export const VISION_FOV = (78 * Math.PI) / 180;
export const CHASE_SPEED = 132;
export const SEARCH_SPEED = 92;

export function createGuard(def) {
  const [sx, sy] = def.spawn;
  return {
    x: (sx + 0.5) * TILE,
    y: (sy + 0.5) * TILE,
    angle: Math.PI / 2, // faces down the hall at first
    state: "patrol",
    suspicion: 0,
    patrol: def.patrol.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })),
    waypoint: 0,
    patrolSpeed: def.speed,
    waitTimer: 0,
    scanDir: 1,
    lastSeen: null,
    loseTimer: 0,
    searchTimer: 0,
    stepTimer: 0,
    justAlerted: false,
  };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Segment (x0,y0)->(x1,y1) clear of sight-blocking tiles?
export function lineOfSightClear(x0, y0, x1, y1, isSightSolid) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (isSightSolid(tx, ty)) return false;
  }
  return true;
}

// Can this guard see the player right now?
export function guardCanSee(guard, player, isSightSolid) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return { sees: false, dist };
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, guard.angle)) > VISION_FOV / 2) return { sees: false, dist };
  if (!lineOfSightClear(guard.x, guard.y, player.x, player.y, isSightSolid)) {
    return { sees: false, dist };
  }
  return { sees: true, dist };
}

// The vision cone as a polygon, clipped by walls: cast rays across the
// field of view and stop each one at the first sight-blocking tile.
export function guardConePoints(guard, isSightSolid) {
  const rays = 26;
  const pts = [[guard.x, guard.y]];
  for (let i = 0; i <= rays; i++) {
    const a = guard.angle - VISION_FOV / 2 + (VISION_FOV * i) / rays;
    let r = VISION_RANGE;
    for (let d = 12; d <= VISION_RANGE; d += 10) {
      const px = guard.x + Math.cos(a) * d;
      const py = guard.y + Math.sin(a) * d;
      if (isSightSolid(Math.floor(px / TILE), Math.floor(py / TILE))) {
        r = d;
        break;
      }
    }
    pts.push([guard.x + Math.cos(a) * r, guard.y + Math.sin(a) * r]);
  }
  return pts;
}

function moveToward(guard, tx, ty, speed, dt, isSolid) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  // Axis-separated movement so guards slide along walls like the player.
  if (!pointHitsSolid(nx, guard.y, isSolid)) guard.x = nx;
  if (!pointHitsSolid(guard.x, ny, isSolid)) guard.y = ny;
  guard.angle = Math.atan2(dy, dx);
  return Math.hypot(tx - guard.x, ty - guard.y) < 3;
}

function pointHitsSolid(px, py, isSolid) {
  return isSolid(Math.floor(px / TILE), Math.floor(py / TILE));
}

// One frame of guard AI. Returns nothing; mutates the guard in place.
// opts: { isSolid, isSightSolid, player, inShadow, dt, audio, onAlert }
export function updateGuard(guard, opts) {
  const { isSolid, isSightSolid, player, inShadow, dt, audio, onAlert } = opts;
  const seen = guardCanSee(guard, player, isSightSolid);

  // --- suspicion: rises while the player is in the cone, decays otherwise.
  if (seen.sees) {
    let rate = 72 * (1 - (seen.dist / VISION_RANGE) * 0.7);
    if (player.sneaking) rate *= 0.55;
    if (inShadow) rate *= 0.5;
    if (player.moving) rate *= 1.15;
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseTimer = 0;
  } else {
    const decay = guard.state === "patrol" ? 42 : 26;
    guard.suspicion = Math.max(0, guard.suspicion - decay * dt);
    if (guard.state === "alert") guard.loseTimer += dt;
  }

  // --- state transitions.
  if (guard.state !== "alert" && guard.suspicion >= 100) {
    guard.state = "alert";
    guard.justAlerted = true;
    audio.alarm();
    onAlert?.(guard);
  } else if (guard.state === "patrol" && guard.suspicion >= 35) {
    guard.state = "suspicious";
    audio.spotted();
  } else if (guard.state === "suspicious" && guard.suspicion <= 2) {
    guard.state = "patrol";
  } else if (guard.state === "alert" && guard.loseTimer > 2.5) {
    guard.state = "search";
    guard.searchTimer = 3;
  } else if (guard.state === "search" && guard.searchTimer <= 0 && guard.suspicion <= 2) {
    guard.state = "patrol";
    guard.lastSeen = null;
  }

  // --- movement by state.
  let moving = false;
  if (guard.state === "patrol") {
    if (guard.waitTimer > 0) {
      guard.waitTimer -= dt;
      guard.angle += guard.scanDir * 0.7 * dt; // look around while waiting
    } else {
      const target = guard.patrol[guard.waypoint];
      moving = true;
      const arrived = moveToward(guard, target.x, target.y, guard.patrolSpeed, dt, isSolid);
      if (arrived) {
        guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
        guard.waitTimer = 0.9;
        guard.scanDir *= -1;
      }
    }
  } else if (guard.state === "suspicious") {
    // Freeze and stare at the last seen spot (or the player, if visible).
    const focus = seen.sees ? player : guard.lastSeen;
    if (focus) {
      const want = Math.atan2(focus.y - guard.y, focus.x - guard.x);
      guard.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, angleDiff(want, guard.angle)));
    }
  } else if (guard.state === "alert") {
    moving = true;
    moveToward(guard, player.x, player.y, CHASE_SPEED, dt, isSolid);
  } else if (guard.state === "search") {
    if (guard.lastSeen) {
      moving = true;
      const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, SEARCH_SPEED, dt, isSolid);
      if (arrived) {
        guard.searchTimer -= dt;
        guard.angle += 1.1 * dt; // scan the area
        moving = false;
      }
    } else {
      guard.searchTimer -= dt;
    }
  }

  // --- footsteps, panned by where the guard is relative to the player.
  if (moving) {
    guard.stepTimer -= dt;
    if (guard.stepTimer <= 0) {
      const dx = guard.x - player.x;
      const dist = Math.hypot(dx, guard.y - player.y);
      audio.guardStep(Math.max(-1, Math.min(1, dx / 420)), dist);
      guard.stepTimer = guard.state === "alert" ? 0.3 : 0.45;
    }
  }
}
