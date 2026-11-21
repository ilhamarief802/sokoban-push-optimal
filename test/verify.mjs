// A strict, step-by-step verifier for Sokoban answers: it never solves anything, it replays a candidate's moves
// against a level and says exactly what happens, step by step, so a solver can be judged before its answer is
// trusted. The rules it replays are the contest's (RULES.txt, Scoring):
//
//   - the level is XSB: '#' wall, ' ' floor, '.' goal, '$' box, '*' box on a goal, '@' player, '+' player on a goal;
//     lines are split on '\n' with empty lines dropped, the board is as wide as its widest line, and a cell past the
//     end of a shorter line is wall;
//   - the answer is solution.txt: letters u d l r in either case, whitespace ignored, any other character invalid,
//     and an empty answer valid (no moves);
//   - a step into a wall, or one pushing a box into a wall or another box, is illegal and scores 0;
//   - the answer is solved when every box ends on a goal: 1,000 points when the pushes equal the level's P*, else
//     500 x P* / pushes; a replay that ends unsolved scores 0.
//
// On top of the rules it reports what a solver needs to know about a finished route: the pushes it took, whether the
// player ever had to leave the board's floor, and the deadlocks it can see in the final position (a box in a corner
// or against a wall edge it can never leave), which is the check that catches a route that "solved" a level by
// shoving a box somewhere it can never come back from.

// The board's parse and its deadlock test are shared with the solver (level.js), so a route is judged against the
// very same cells it was planned on.
import { STEP, parseLevel, readMoves, deadlocked } from '../level.js';

export { parseLevel, readMoves, deadlocked, STEP };

/**
 * Replays an answer. Returns the verdict the checker would reach, plus the route it walked:
 *   { valid, solved, pushes, moves, points, reason, illegalAt, boxes }
 * `key` is the level's {pushes} (P*), optional: without it points cannot be computed.
 */
export function verify(levelText, answerText, key = null) {
  const level = parseLevel(levelText);
  const { moves, odd } = readMoves(answerText);
  const base = { moves: moves.length, pushes: 0, solved: false, valid: odd === null, boxes: [] };
  if (odd !== null) {
    return { ...base, points: 0, reason: `solution holds ${JSON.stringify(odd)}, which is no move (u, d, l or r)`, illegalAt: -1 };
  }
  const w = level.width;
  const box = level.box.slice();
  let player = level.player;
  if (player < 0) return { ...base, points: 0, reason: 'the level has no player', illegalAt: -1 };
  let pushes = 0;
  for (let k = 0; k < moves.length; k += 1) {
    const [dx, dy] = STEP[moves[k].toLowerCase()];
    const d = dy * w + dx;
    const next = player + d;
    if (level.wall[next] === 1) {
      return { ...base, pushes, points: 0, reason: `move ${k + 1} (${moves[k]}) walks into a wall`, illegalAt: k };
    }
    if (box[next] === 1) {
      const beyond = next + d;
      if (level.wall[beyond] === 1) {
        return { ...base, pushes, points: 0, reason: `move ${k + 1} (${moves[k]}) pushes a box into a wall`, illegalAt: k };
      }
      if (box[beyond] === 1) {
        return { ...base, pushes, points: 0, reason: `move ${k + 1} (${moves[k]}) pushes a box into another box`, illegalAt: k };
      }
      box[next] = 0;
      box[beyond] = 1;
      pushes += 1;
    }
    player = next;
  }
  const boxes = [];
  for (let i = 0; i < box.length; i += 1) if (box[i] === 1) boxes.push(i);
  const off = boxes.filter((i) => level.goal[i] !== 1);
  if (off.length > 0) {
    return {
      ...base,
      pushes,
      boxes,
      points: 0,
      reason: `the replay ends with ${off.length} box(es) off a goal, after ${moves.length} moves and ${pushes} pushes`,
    };
  }
  if (key === null) return { ...base, pushes, boxes, solved: true, points: null, reason: `solved in ${pushes} pushes (P* unknown)`, deadlocks: [] };
  const points = pushes <= key.pushes ? 1000 : (500 * key.pushes) / pushes;
  return {
    ...base,
    pushes,
    boxes,
    solved: true,
    points,
    pStar: key.pushes,
    deadlocks: boxes.map((i) => deadlocked(level, i)).filter((kind) => kind !== 'none'),
    reason: `solved in ${pushes} pushes (P* ${key.pushes})`,
  };
}

// CLI: node test/verify.mjs <level.txt> <solution.txt> [P*]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [levelPath, answerPath, pStar] = process.argv.slice(2);
  if (!levelPath || !answerPath) {
    console.error('usage: node test/verify.mjs <level.txt> <solution.txt> [P*]');
    process.exit(2);
  }
  const { readFileSync } = await import('node:fs');
  const verdict = verify(readFileSync(levelPath, 'utf8'), readFileSync(answerPath, 'utf8'), pStar ? { pushes: Number(pStar) } : null);
  console.log(JSON.stringify(verdict, null, 1));
  process.exit(verdict.points === 1000 ? 0 : 1);
}
