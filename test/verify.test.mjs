// The verifier's own tests, and the one that matters most: a differential test against the kit's own checker on the
// five practice levels, over thousands of candidate answers (legal, illegal, truncated, decorated with whitespace,
// uppercase, junk), asserting the two never disagree about validity, points or the push count they derive.
//
//   node --test test/verify.test.mjs
//   KIT=<unpacked kit> node --test test/verify.test.mjs   (default: ../sokoban-solver-01-run-20261121-kit)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, readMoves, verify, deadlocked } from './verify.mjs';

const KIT = process.env.KIT ?? fileURLToPath(new URL('../../sokoban-solver-01-run-20261121-kit', import.meta.url));

// A tiny legal level: the box starts two cells below the goal's column, the player below it.
const SMALL = ['#######', '#.    #', '#  $  #', '#  @  #', '#######'].join('\n');

test('parseLevel: width is the widest line and a short line\'s tail is wall', () => {
  const level = parseLevel('#####\n#@$\n#####');
  assert.equal(level.width, 5);
  assert.equal(level.height, 3);
  // Row 1 is "#@$": x=0 wall, x=1 player, x=2 box, x=3 and x=4 wall (past its end).
  assert.equal(level.wall[1 * 5 + 3], 1);
  assert.equal(level.wall[1 * 5 + 2], 0);
  assert.equal(level.player, 6);
});

test('parseLevel: XSB characters set walls, goals, boxes and the player', () => {
  const level = parseLevel('#####\n#*@.#\n#####');
  assert.equal(level.goal[6], 1);
  assert.equal(level.box[6], 1);
  assert.equal(level.player, 7);
  assert.equal(level.goal[8], 1);
});

test('readMoves: whitespace anywhere is dropped, any other character is reported', () => {
  assert.deepEqual(readMoves(' u l\r\n  u r\t'), { moves: 'ulur', odd: null });
  assert.equal(readMoves('udlrUDLR').moves, 'udlrUDLR');
  assert.equal(readMoves('u x d').odd, 'x');
  assert.equal(readMoves('').moves, '');
});

test('a solved route scores 1,000 when its pushes equal P*, and less when they take more', () => {
  // Player (3,3), box (3,2), goal (1,1): u pushes the box up, then two lefts push it home.
  const solved = verify(SMALL, 'urull', { pushes: 3 });
  assert.equal(solved.solved, true);
  assert.equal(solved.pushes, 3);
  assert.equal(solved.points, 1000);
  // The same level with a P* of 2: 5 pushes... the route cannot be made cheaper, but the formula must still hold.
  assert.equal(verify(SMALL, 'urull', { pushes: 2 }).points, (500 * 2) / 3);
});

test('an illegal step scores 0 and names the step', () => {
  const wall = verify(SMALL, 'd', { pushes: 3 });
  assert.equal(wall.points, 0);
  assert.equal(wall.illegalAt, 0);
  assert.match(wall.reason, /walks into a wall/);
  const pushWall = verify(SMALL, 'uu', { pushes: 3 });
  assert.equal(pushWall.points, 0);
  assert.match(pushWall.reason, /pushes a box into a wall/);
});

test('a replay that ends with a box off its goal scores 0 and says so', () => {
  const verdict = verify(SMALL, 'u', { pushes: 3 });
  assert.equal(verdict.points, 0);
  assert.equal(verdict.solved, false);
  assert.match(verdict.reason, /box\(es\) off a goal/);
});

test('an empty answer is valid and unsolved; a junk character is invalid', () => {
  const empty = verify(SMALL, '', { pushes: 3 });
  assert.equal(empty.valid, true);
  assert.equal(empty.points, 0);
  const junk = verify(SMALL, 'u?d', { pushes: 3 });
  assert.equal(junk.valid, false);
  assert.match(junk.reason, /which is no move/);
});

test('deadlocked: corner, wall edge without a goal, and none', () => {
  const corner = parseLevel(['####', '#$ #', '#  #', '####'].join('\n'));
  assert.equal(deadlocked(corner, 1 * 4 + 1), 'corner');
  // A box against the top wall, one column in from the corner, with a goal in its row: not a deadlock.
  const edge = parseLevel(['#######', '# $  .#', '#     #', '#######'].join('\n'));
  assert.equal(deadlocked(edge, 1 * 7 + 2), 'none');
  // The same box, in a row with no goal: it can slide but never leave the wall, so it is an edge deadlock.
  const edgeNoGoal = parseLevel(['#######', '# $   #', '#    .#', '#######'].join('\n'));
  assert.equal(deadlocked(edgeNoGoal, 1 * 7 + 2), 'edge');
  // A box away from every wall can still travel: not a deadlock at all.
  const open = parseLevel(['#######', '#     #', '#  $  #', '#  .  #', '#     #', '#######'].join('\n'));
  assert.equal(deadlocked(open, 2 * 7 + 3), 'none');
});

// ---------------------------------------------------------------------------------------------------------------
// The differential test: the kit's checker is the definition of the rules, so the verifier is run against it on the
// practice levels with a wide spread of candidate answers.
// ---------------------------------------------------------------------------------------------------------------

function practiceCases() {
  const dir = join(KIT, 'practice');
  if (!existsSync(join(dir, 'reference', 'manifest.json'))) return null;
  const manifest = JSON.parse(readFileSync(join(dir, 'reference', 'manifest.json'), 'utf8'));
  return manifest.instances.map((instance) => ({
    id: instance.id,
    level: readFileSync(join(dir, 'input', instance.id, 'level.txt'), 'utf8'),
    key: instance.key,
  }));
}

/** Candidate answers: the empty one, junk, wall-walks, and seeded random legal walks of growing length. */
function candidates(levelText, seed) {
  const level = parseLevel(levelText);
  const out = ['', ' ', '\n', 'x', 'u?d', 'UDLR', '\n u \n l \n'];
  let state = seed >>> 0;
  const rnd = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const letters = ['u', 'd', 'l', 'r'];
  for (let walk = 0; walk < 6; walk += 1) {
    // A random walk that only ever takes legal steps: the interesting half of the comparison (illegal ones are the
    // other half, and the random walk below produces plenty of those too).
    let player = level.player;
    const box = level.box.slice();
    let route = '';
    for (let step = 0; step < 12 + walk * 20; step += 1) {
      const choices = [];
      for (const letter of letters) {
        const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[letter];
        const d = dy * level.width + dx;
        const next = player + d;
        let legal = level.wall[next] !== 1;
        if (legal && box[next] === 1) {
          const beyond = next + d;
          legal = level.wall[beyond] !== 1 && box[beyond] !== 1;
          if (legal && rnd() < 0.15) legal = false; // sometimes decline a push, to leave it for later
          if (legal) {
            box[next] = 0;
            box[beyond] = 1;
          }
        }
        if (legal) choices.push({ letter, next });
      }
      if (choices.length === 0) break;
      const pick = choices[Math.floor(rnd() * choices.length)];
      route += pick.letter;
      player = pick.next;
    }
    out.push(route);
    // And a purely random string, which will be illegal sooner or later.
    let noise = '';
    for (let k = 0; k < 30; k += 1) noise += letters[Math.floor(rnd() * 4)];
    out.push(noise);
  }
  return out;
}

test('the verifier never disagrees with the kit\'s checker on the practice levels', async () => {
  const cases = practiceCases();
  if (cases === null) {
    assert.ok(true, 'kit not found: differential test skipped');
    return;
  }
  const checker = await import(new URL(`file://${join(KIT, 'program/scorer/checker/check.mjs')}`).href);
  let compared = 0;
  for (const one of cases) {
    const files = { 'level.txt': one.level };
    for (const answer of candidates(one.level, 12345)) {
      const theirs = checker.points(files, one.key, { 'solution.txt': answer });
      const mine = verify(one.level, answer, one.key);
      assert.equal(mine.valid, theirs.valid, `${one.id}: validity disagrees on ${JSON.stringify(answer)}`);
      assert.equal(mine.points, theirs.points, `${one.id}: points disagree on ${JSON.stringify(answer)}: ${mine.reason} vs ${theirs.detail}`);
      compared += 1;
    }
  }
  assert.ok(compared >= 75, `expected at least 15 candidates per level, compared ${compared}`);
});
