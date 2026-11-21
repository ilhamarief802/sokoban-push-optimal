// The board, read once and shared: the verifier (test/verify.mjs) and the solver (solver.js) must agree on what a
// level is, cell for cell, so the parse lives here and nowhere else.
//
// XSB, exactly as the contest's checker reads it: lines split on '\n' with empty lines dropped, the board is as wide
// as its widest line, and a cell past the end of a shorter line is wall. '#' wall, '.' goal, '$' box, '*' box on a
// goal, '@' player, '+' player on a goal, anything else floor.

export const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

export function parseLevel(text) {
  const rows = String(text).split('\n').filter((row) => row.length > 0);
  if (rows.length === 0) throw new Error('the level is empty');
  const width = Math.max(...rows.map((row) => row.length));
  const height = rows.length;
  const size = width * height;
  const wall = new Uint8Array(size).fill(1);
  const goal = new Uint8Array(size);
  const box = new Uint8Array(size);
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      const i = y * width + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goal[i] = 1;
      if (ch === '$' || ch === '*') box[i] = 1;
      if (ch === '@' || ch === '+') player = i;
    }
  });
  return { width, height, wall, goal, box, player, step: STEP };
}

/** The answer's moves, or the character that is no move. */
export function readMoves(text) {
  const moves = String(text).replace(/\s+/g, '');
  const odd = /[^udlrUDLR]/.exec(moves);
  return { moves, odd: odd === null ? null : odd[0] };
}

/**
 * A box's deadlock from the position it stands in: 'corner' when it is wedged between two walls, 'edge' when it is
 * against one wall and the line it can still slide along holds no goal, 'none' otherwise. A box on a goal is never
 * reported: it may be immobile, but its job is done.
 */
export function deadlocked(level, i) {
  const { width: w, height: h, wall, goal } = level;
  if (goal[i] === 1) return 'none';
  const up = wall[i - w] === 1;
  const down = wall[i + w] === 1;
  const left = wall[i - 1] === 1;
  const right = wall[i + 1] === 1;
  if ((up || down) && (left || right)) return 'corner';
  const y = Math.floor(i / w);
  const x = i % w;
  if (up || down) {
    for (let k = 0; k < w; k += 1) if (goal[y * w + k] === 1) return 'none';
    return 'edge';
  }
  if (left || right) {
    for (let k = 0; k < h; k += 1) if (goal[k * w + x] === 1) return 'none';
    return 'edge';
  }
  return 'none';
}
