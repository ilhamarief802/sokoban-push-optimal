// The behaviour-only gate: it imports nothing but solve() from the entry, so it gates a code-golfed solver exactly as
// it gates the readable one. Every practice level must be solved, replayed step by step by test/verify.mjs, scored 1000
// by the kit's own checker, equal to the published P*, deterministic, and under the answer-size cap.
//
//   KIT=<unpacked kit> node --test test/verify-solutions.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from './verify.mjs';
import { solve } from '../solver.js';

const KIT = process.env.KIT ?? fileURLToPath(new URL('../../sokoban-solver-01-run-20261121-kit', import.meta.url));

const cases = () => {
  const manifest = join(KIT, 'practice', 'reference', 'manifest.json');
  if (!existsSync(manifest)) return null;
  const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
  return parsed.instances.map((instance) => ({
    id: instance.id,
    level: readFileSync(join(KIT, 'practice', 'input', instance.id, 'level.txt'), 'utf8'),
    key: instance.key,
  }));
};

test('every practice level: solved, replayed, P* hit, 1000 points, deterministic, under the cap', async () => {
  const all = cases();
  if (all === null) return assert.ok(true, 'kit not found: skipped');
  const checker = await import(new URL(`file://${join(KIT, 'program/scorer/checker/check.mjs')}`).href);
  for (const one of all) {
    const first = solve(one.level);
    assert.ok(first && typeof first.moves === 'string', `${one.id}: solve() returned no moves`);
    const verdict = verify(one.level, first.moves, one.key);
    assert.equal(verdict.valid, true, `${one.id}: ${verdict.reason}`);
    assert.equal(verdict.solved, true, `${one.id}: ${verdict.reason}`);
    assert.equal(verdict.pushes, one.key.pushes, `${one.id}: ${verdict.pushes} pushes against P* ${one.key.pushes}`);
    const theirs = checker.points({ 'level.txt': one.level }, one.key, { 'solution.txt': first.moves });
    assert.equal(theirs.points, 1000, `${one.id}: the kit's checker says ${theirs.detail}`);
    assert.ok(first.moves.length <= 65536, `${one.id}: ${first.moves.length} bytes over the 65,536 cap`);
    assert.equal(solve(one.level).moves, first.moves, `${one.id}: not deterministic`);
    console.log(`  ${one.id}: ${verdict.pushes} pushes, ${first.moves.length} moves`);
  }
});
