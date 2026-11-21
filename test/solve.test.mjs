// The solver, judged by the verifier and by the kit's own checker, on the five practice levels.
//
//   node --test test/solve.test.mjs
//   KIT=<unpacked kit> node --test test/solve.test.mjs
//
// Every assertion here is about a real route the solver produced: it is replayed step by step by test/verify.mjs, then
// scored by the kit's checker, and its push count is compared with the level's published P* (reference/manifest.json).
// No route is ever trusted because the solver "says" it solved something.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel } from '../level.js';
import { verify } from './verify.mjs';
import { solve, decompose } from '../solver.js';

const KIT = process.env.KIT ?? fileURLToPath(new URL('../../sokoban-solver-01-run-20261121-kit', import.meta.url));
const PRACTICE = join(KIT, 'practice');

const cases = () => {
  const manifest = join(PRACTICE, 'reference', 'manifest.json');
  if (!existsSync(manifest)) return null;
  const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
  return parsed.instances.map((instance) => ({
    id: instance.id,
    level: readFileSync(join(PRACTICE, 'input', instance.id, 'level.txt'), 'utf8'),
    key: instance.key,
  }));
};

test('decomposition keeps every box and goal, and no door is a goal', () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  for (const one of all) {
    const level = parseLevel(one.level);
    const dec = decompose(level);
    assert.equal(dec.ok, true, `${one.id}: ${dec.why}`);
    const boxes = [...level.box].reduce((a, b) => a + b, 0);
    const inRooms = dec.rooms.reduce((a, r) => a + r.boxes.length, 0);
    assert.equal(inRooms, boxes, `${one.id}: every box belongs to a room`);
    for (const room of dec.rooms) {
      assert.equal(room.boxes.length, room.goals, `${one.id}: a room's boxes match its goals`);
      assert.notEqual(level.goal[room.door], 1, `${one.id}: a door is not a goal`);
      // The door is one row off the hallway and shares its column with the square the player enters from.
      assert.equal(room.door % level.width, room.hall % level.width, `${one.id}: door and entry share a column`);
      assert.equal(Math.abs(Math.floor(room.door / level.width) - Math.floor(room.hall / level.width)), 1, `${one.id}: the entry is one row off the door`);
    }
    // The published key says how many rooms the level has; the decomposition must agree.
    if (Array.isArray(one.key.rooms)) assert.equal(dec.rooms.length, one.key.rooms.length, `${one.id}: room count`);
  }
});

test('every practice level solves, verifies step by step, and hits its published P*', () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  for (const one of all) {
    const started = Date.now();
    const answer = solve(one.level);
    const took = Date.now() - started;
    assert.equal(answer.why, null, `${one.id}: ${answer.why}`);
    const verdict = verify(one.level, answer.moves, one.key);
    assert.equal(verdict.valid, true, `${one.id}: ${verdict.reason}`);
    assert.equal(verdict.solved, true, `${one.id}: ${verdict.reason}`);
    assert.equal(verdict.pushes, one.key.pushes, `${one.id}: pushes ${verdict.pushes}, P* ${one.key.pushes}`);
    assert.equal(verdict.points, 1000, `${one.id}: ${verdict.reason}`);
    assert.deepEqual(verdict.deadlocks, [], `${one.id}: a box ends deadlocked`);
    assert.ok(took < 20000, `${one.id}: solved in ${took} ms`);
    console.log(`  ${one.id}: ${verdict.pushes} pushes, ${verdict.moves} moves, ${took} ms, rooms ${answer.rooms}`);
  }
});

test('solving twice gives byte-identical routes', () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  for (const one of all) {
    assert.equal(solve(one.level).moves, solve(one.level).moves, `${one.id}: not deterministic`);
  }
});

test('the kit\'s own checker gives every practice route 1,000 points', async () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  const checker = await import(new URL(`file://${join(KIT, 'program/scorer/checker/check.mjs')}`).href);
  for (const one of all) {
    const answer = solve(one.level);
    const theirs = checker.points({ 'level.txt': one.level }, one.key, { 'solution.txt': answer.moves });
    assert.equal(theirs.points, 1000, `${one.id}: ${theirs.detail}`);
    assert.ok(answer.moves.length * 1 < 65536, `${one.id}: ${answer.moves.length} bytes, under the 65,536 cap`);
  }
});

test('the split is the geometry\'s: one hallway row, one door per room, no push ever crosses one', () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  for (const one of all) {
    const level = parseLevel(one.level);
    const dec = decompose(level);
    assert.equal(dec.ok, true, `${one.id}: ${dec.why}`);
    // The hallway row is the row with the most floor, and no box ever stands on it.
    const row = dec.hallRow;
    for (let x = 0; x < level.width; x += 1) assert.equal(level.box[row * level.width + x], 0, `${one.id}: a box starts in the hallway`);
    for (const room of dec.rooms) {
      assert.equal(Math.abs(Math.floor(room.door / level.width) - row), 1, `${one.id}: a door sits one row off the hallway`);
      assert.equal(Math.floor(room.hall / level.width), row, `${one.id}: the entry square is on the hallway row`);
      assert.equal(room.door % level.width, room.hall % level.width, `${one.id}: the door and its entry square share a column`);
      // Every box of the room is inside the room's own floor, never on the hallway row.
      for (const b of room.boxes) assert.equal(room.cells.includes(b), true, `${one.id}: a box is outside its room`);
    }
    // Replaying the answer, every push must land inside one room and never on the hallway row: that is what makes the
    // sum of the rooms' optima the level's optimum, and it is checked on the real route, not assumed.
    const answer = solve(one.level);
    const boxes = level.box.slice();
    let player = level.player;
    for (const ch of answer.moves) {
      const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[ch];
      const d = dy * level.width + dx;
      const next = player + d;
      if (boxes[next] === 1) {
        assert.notEqual(Math.floor((next + d) / level.width), row, `${one.id}: a push crossed into the hallway`);
        boxes[next] = 0;
        boxes[next + d] = 1;
      }
      player = next;
    }
  }
});
