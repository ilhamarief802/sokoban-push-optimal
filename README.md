# Push-optimal Sokoban solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/ilhamarief802/sokoban-push-optimal/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/ilhamarief802/sokoban-push-optimal/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

An entry in [make.fun's Sokoban solver bounty](https://make.fun/bounty/sokoban-solver-01-run-20261121): for every level
under `/input`, write the player's moves to `/output/<id>/solution.txt`.

**Result on the practice instance: 1,000,000 points — all five levels solved in exactly P\*, the push-optimal count**
(13, 16, 29, 47 and 60 pushes), each route replayed step by step before it is written.

## How it solves

1. **Split at the doors.** The generator carves a hallway one square wide across the board with up to four rooms of a
   6 × 6 slot off it, each opening through one door. A box pushed out of a door can never be pushed back, so no
   push-optimal solution ever crosses one, and the level's P\* is the sum of its rooms' optima. `decompose()` finds the
   hallway row (the player starts on it), takes every floor cell one row off it that opens onto it as a door, and floods
   from each door without stepping onto the hallway row to get that room's floor.
2. **Solve each room to its own optimum.** `planRoom()` is a breadth-first search over *pushes* — a state is the boxes
   plus the smallest square of the player's reachable region, which names that region because the region is a function
   of the boxes. One push per edge, so the first solved state is push-optimal.
3. **Prune only what is sound.** A square is live when some sequence of pushes, other boxes aside, brings a box from it
   onto a goal; computed backwards from the goals. A box on a dead square can never reach a goal, so pruning it cannot
   lose an optimum. (An earlier corner-and-edge test was **unsound** and was removed: a box pinned to a wall can still
   slide to a column where it can be pushed away from the wall.)
4. **Stitch with the walking.** The player is walked along the hallway to each room in turn. A room can end with a box
   on its own door and seal the player in, so the room order backtracks over the at most four rooms instead of
   committing to the nearest-first order.

## Files

| file | job |
| --- | --- |
| `main.ts` | the harness entry point: read each level, write each answer |
| `solver.js` | the split, the per-room push search, and the stitching |
| `level.js` | the XSB parse and the shared deadlock test — the one place a board is read |
| `test/verify.mjs` | a strict step-by-step replay of any answer against its level |
| `test/verify.test.mjs` | the verifier's own tests, and a differential test against the kit's checker |
| `test/solve.test.mjs` | every practice route replayed, scored by the kit's checker, and compared with its published P\* |

## Run it

```sh
# the answers, exactly as the harness runs them
MAKEFUN_INPUT_DIR=<kit>/practice/input MAKEFUN_OUTPUT_DIR=out node main.ts

# the verifier's tests, and the differential test against the kit's checker
KIT=<unpacked kit> npm test
```

`npm test` needs the unpacked kit for the differential test (set `KIT` to its path); without it, that one test skips
and the rest still run.
