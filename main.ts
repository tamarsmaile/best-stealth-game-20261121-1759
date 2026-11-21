// Night Shift: The Quiet Vault — entrypoint (program/v1).
//
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory and writes dossier.json there with the kit's
// buildDossier. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output. Node 22 standard library only; no install, no network.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const gameDir = join(repoRoot, "game");
const shotsDir = join(repoRoot, "screenshots");
if (!existsSync(gameDir)) throw new Error(`game/ not found in ${repoRoot}`);
if (!existsSync(shotsDir)) throw new Error(`screenshots/ not found in ${repoRoot}`);

// Start from an empty output directory so a stale file can never leak in.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The game as static files, and the screenshots of its own code running.
cpSync(gameDir, join(outDir, "game"), { recursive: true });
cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });

// The dossier the scorer rebuilds and compares byte for byte.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`wrote ${outDir} (dossier ${dossier.length} bytes)`);
