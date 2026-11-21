// The program the harness runs (node22): for every level under /input, write that level's answer to
// /output/<id>/solution.txt — the player's moves in LURD, one letter a step, a capital letter marking a push (the
// replay decides legality, not the case). Outside a container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for
// /input and /output.
//
// The solver is solve.js: it splits the level at its doors, solves each room to its own push optimum, and stitches the
// rooms with the player's walking, which is exactly the level's P* because a box can never come back through a door.
// A level the solver cannot split (or a room it cannot plan) is answered with no moves rather than a guess: an empty
// answer is valid and scores nothing, while a wrong route scores nothing and hides that the room was unplanned.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { solve } from './solver.js';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

for (const id of readdirSync(INPUT_DIR).sort()) {
  const level = readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8');
  const answer = solve(level);
  mkdirSync(join(OUTPUT_DIR, id), { recursive: true });
  writeFileSync(join(OUTPUT_DIR, id, 'solution.txt'), `${answer.moves ?? ''}\n`);
}
