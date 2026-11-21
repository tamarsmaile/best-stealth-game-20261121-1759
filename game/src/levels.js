// Night Shift: The Quiet Vault — level definitions.
//
// Legend (one character per tile, 20 x 14 tiles, 48 px each):
//   #  wall (blocks movement and sight)      .  open floor
//   ,  shadow floor (guards spot you slower) C  crate (cover: blocks sight + movement)
//   *  data shard to collect                E  exit (opens once every shard is taken)
//   P  player spawn                         G  guard spawn (patrol waypoints below)
export const TILE = 48;
export const COLS = 20;
export const ROWS = 14;

export const LEVELS = [
  {
    name: "The Quiet Gallery",
    intro: "One guard walks the lower hall. Learn his patrol, slip behind the crates, take both shards, then reach the green exit unseen.",
    grid: [
      "####################",
      "#P....,,.....#....*#",
      "#.....C.....#......#",
      "#.........C.#......#",
      "#..####.....#..##..#",
      "#..####..C..#..##..#",
      "#..................#",
      "#..C....,,.....C...#",
      "#......####........#",
      "#......####..C.....#",
      "#..,,.........,,...#",
      "#....C.....C.......#",
      "#*......G........E.#",
      "####################",
    ],
    guards: [
      { spawn: [8, 12], patrol: [[8, 12], [16, 12]], speed: 52 },
    ],
  },
  {
    name: "The Vault Corridor",
    intro: "Two guards cross the vault floor. The middle columns are watched — use the shadow patches and the crates on the flanks.",
    grid: [
      "####################",
      "#P...#......#...*..#",
      "#....#..C...#......#",
      "#.C..#......#..C...#",
      "#....#..,,..#......#",
      "#....####...####...#",
      "#.........*........#",
      "#..C....#...#...C..#",
      "#.......#...#......#",
      "#..,,...#...#...,,.#",
      "#.......#...#......#",
      "#..C....#...#..C...#",
      "#*...G..#...G....E.#",
      "####################",
    ],
    guards: [
      { spawn: [5, 12], patrol: [[5, 12], [5, 6], [7, 6], [7, 12]], speed: 58 },
      { spawn: [12, 12], patrol: [[13, 12], [17, 12], [17, 6], [13, 6]], speed: 58 },
    ],
  },
  {
    name: "The Director's Wing",
    intro: "Three guards, four shards, one long hall. Wait for the gaps, move in shadow, and do not get greedy — the exit is watched.",
    grid: [
      "####################",
      "#P..#....#....#..*.#",
      "#...#..C.#.C..#....#",
      "#.C.#....#....#.C..#",
      "#...#.,,.#.,,.#....#",
      "##..######.######..#",
      "#.........*........#",
      "#..C.....,,....C...#",
      "#....####..####....#",
      "#....####..####..*.#",
      "#..,,..........,,..#",
      "#....C......C......#",
      "#*.G....G......G.E.#",
      "####################",
    ],
    guards: [
      { spawn: [3, 12], patrol: [[3, 12], [9, 12]], speed: 62 },
      { spawn: [8, 12], patrol: [[8, 12], [8, 10], [15, 10], [15, 12]], speed: 62 },
      { spawn: [14, 12], patrol: [[14, 12], [17, 12], [17, 10], [14, 10]], speed: 62 },
    ],
  },
];

// Parse one level's grid into the structures the game loop uses.
// Throws on a malformed grid so a bad map can never ship silently.
export function parseLevel(level) {
  if (level.grid.length !== ROWS) {
    throw new Error(`level ${level.name}: expected ${ROWS} rows, got ${level.grid.length}`);
  }
  const walls = [];
  const crates = [];
  const shadows = [];
  const shards = [];
  let playerSpawn = null;
  let exit = null;
  const guardSpawns = [];
  for (let y = 0; y < ROWS; y++) {
    const row = level.grid[y];
    if (row.length !== COLS) {
      throw new Error(`level ${level.name} row ${y}: expected ${COLS} chars, got ${row.length}: ${row}`);
    }
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      if (ch === "#") walls.push([x, y]);
      else if (ch === "C") crates.push([x, y]);
      else if (ch === ",") shadows.push([x, y]);
      else if (ch === "*") shards.push({ x, y, taken: false });
      else if (ch === "P") playerSpawn = { x, y };
      else if (ch === "E") exit = { x, y };
      else if (ch === "G") guardSpawns.push({ x, y });
      else if (ch !== ".") throw new Error(`level ${level.name}: unknown tile ${ch} at ${x},${y}`);
    }
  }
  if (!playerSpawn) throw new Error(`level ${level.name}: no player spawn`);
  if (!exit) throw new Error(`level ${level.name}: no exit`);
  if (shards.length === 0) throw new Error(`level ${level.name}: no shards`);
  if (guardSpawns.length !== level.guards.length) {
    throw new Error(`level ${level.name}: ${guardSpawns.length} G tiles but ${level.guards.length} guard defs`);
  }
  return { walls, crates, shadows, shards, playerSpawn, exit, guardSpawns };
}

// True when the tile at (tx, ty) blocks movement.
export function makeSolidChecker(parsed) {
  const solid = new Set();
  for (const [x, y] of parsed.walls) solid.add(`${x},${y}`);
  for (const [x, y] of parsed.crates) solid.add(`${x},${y}`);
  return (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return solid.has(`${tx},${ty}`);
  };
}

// True when the tile at (tx, ty) blocks a guard's line of sight.
export function makeSightChecker(parsed) {
  return makeSolidChecker(parsed);
}

// Is the pixel point (px, py) standing on a shadow tile?
export function onShadow(parsed, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return parsed.shadows.some(([sx, sy]) => sx === tx && sy === ty);
}
