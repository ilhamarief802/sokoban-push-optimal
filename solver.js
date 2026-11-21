// The solver: split a level into its rooms, solve each room to its own push optimum, and stitch the rooms together
// with the player's walking. Every route is replayed by test/verify.mjs before it is written, so a plan this file gets
// wrong is caught before it can be graded.
//
// The geometry is the generator's (program/generator/subject/generate.mjs): a hallway one square wide across the board's
// middle row, up to two rooms of a 6 x 6 slot above it and two below, each room opening onto the hallway through one
// door — a gap in the hallway's wall. A box pushed from a door into the hallway is lost (it can only slide along the
// hallway, and the far side is wall), so no push-optimal solution ever moves a box there, and P* is the sum of the
// rooms' push optima. Cutting at *every* articulation point would be wrong: a room's own carved floor has corridors in
// it, and those are articulation points too. The rooms are found from the hallway instead, which is what the geometry
// actually guarantees.

import { parseLevel } from './level.js';

const DIRS = [
  [0, -1, 'u'],
  [0, 1, 'd'],
  [-1, 0, 'l'],
  [1, 0, 'r'],
];


/** The move letter that steps from `from` to `to`, which must be an orthogonal neighbour on the same board. */
function letterFrom(from, to, w) {
  if (to === from - w) return 'u';
  if (to === from + w) return 'd';
  return to === from - 1 ? 'l' : 'r';
}

/** The floor neighbours of a cell, in u d l r order, written into `out`; returns how many there are. */
function neighbours(level, i, out) {
  const { width: w, height: h, wall } = level;
  if (wall[i] === 1) return 0;
  const x = i % w;
  const y = (i - x) / w;
  let n = 0;
  // Bounds are checked per direction: a bare index offset would wrap a row, and a cell off the board reads as wall
  // only by luck (an index past the end of the array is undefined, not 1).
  if (y > 0 && wall[i - w] !== 1) out[n++] = i - w;
  if (y + 1 < h && wall[i + w] !== 1) out[n++] = i + w;
  if (x > 0 && wall[i - 1] !== 1) out[n++] = i - 1;
  if (x + 1 < w && wall[i + 1] !== 1) out[n++] = i + 1;
  return n;
}

/** The floor neighbours of a cell, as an array. */
export function neighboursOf(level, i) {
  const buf = new Int32Array(4);
  return Array.from(buf.subarray(0, neighbours(level, i, buf)));
}

/**
 * The rooms, from the hallway out: the hallway row is the row with the most floor, a door is a floor cell one row off
 * it that opens onto it, and a room is everything reachable from its door without stepping onto the hallway row.
 * Returns { ok, why } instead of throwing: a level this shape does not split is a fact the caller must see.
 */
export function decompose(level) {
  const { width: w, height: h, wall, goal, box } = level;
  const size = wall.length;

  // The generator starts the player on a hallway square, so the hallway's row is the player's row. (Picking the row with
  // the most floor instead would choose a wide room on a level whose hallway is narrower than its room.)
  let hallRow = level.player >= 0 ? Math.floor(level.player / w) : -1;
  if (hallRow < 0) {
    let best = -1;
    for (let y = 0; y < h; y += 1) {
      let open = 0;
      for (let x = 0; x < w; x += 1) if (wall[y * w + x] !== 1) open += 1;
      if (open > best) {
        best = open;
        hallRow = y;
      }
    }
  }
  if (hallRow < 0) return { ok: false, why: 'no hallway row' };

  const rooms = [];
  const seen = new Uint8Array(size);
  for (const dy of [-1, 1]) {
    const doorRow = hallRow + dy;
    if (doorRow < 0 || doorRow >= h) continue;
    for (let x = 0; x < w; x += 1) {
      const door = doorRow * w + x;
      // Only a floor cell can be a door: the wall cells beside it are what the room is cut by.
      if (wall[door] === 1 || seen[door] === 1) continue;
      // A door opens onto the hallway: the hallway row's cell beside it is floor, and when it is not this is not a door.
      const hallCell = hallRow * w + x;
      if (wall[hallCell] === 1) continue;
      const cells = [];
      const queue = [door];
      seen[door] = 1;
      while (queue.length > 0) {
        const v = queue.pop();
        cells.push(v);
        for (const to of neighboursOf(level, v)) {
          if (Math.floor(to / w) === hallRow || seen[to] === 1) continue;
          seen[to] = 1;
          queue.push(to);
        }
      }
      const boxes = cells.filter((c) => box[c] === 1);
      if (boxes.length === 0) continue;
      rooms.push({
        cells,
        boxes,
        goals: cells.filter((c) => goal[c] === 1).length,
        door,
        // The hallway square the player enters from, and the only square outside the room the plan may use.
        hall: hallRow * w + x,
      });
    }
  }

  if (rooms.length === 0) return { ok: false, why: 'no room holds a box' };
  for (const room of rooms) {
    if (room.boxes.length !== room.goals) {
      return { ok: false, why: `a room holds ${room.boxes.length} box(es) and ${room.goals} goal(s)` };
    }
    if (goal[room.door] === 1) return { ok: false, why: 'a door cell is a goal' };
  }
  const boxesInRooms = rooms.reduce((a, r) => a + r.boxes.length, 0);
  const boxesOnBoard = box.reduce((a, b) => a + b, 0);
  const goalsOnBoard = goal.reduce((a, b) => a + b, 0);
  if (boxesInRooms !== boxesOnBoard) return { ok: false, why: `${boxesInRooms} of ${boxesOnBoard} boxes were put in a room` };
  if (sum(goal) !== boxesOnBoard) return { ok: false, why: `${boxesOnBoard} boxes but ${goalsOnBoard} goals` };
  return { ok: true, rooms, hallRow };
}

/** Sums a Uint8Array. */
function sum(a) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += a[i];
  return total;
}


/**
 * The live squares: those a box can be pushed from onto some goal, ignoring every other box. Computed backwards from
 * the goals — a box at `from` could have been pushed into `v` only when `v - 2d` was floor for the player to stand on —
 * which is the standard sound deadlock test: a box on a square outside this set can never reach a goal, whatever the
 * other boxes do.
 */
export function liveSquares(level) {
  const { width: w, height: h, wall, goal } = level;
  const live = new Uint8Array(wall.length);
  const queue = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  for (let i = 0; i < wall.length; i += 1) {
    if (goal[i] === 1 && wall[i] !== 1) {
      live[i] = 1;
      queue.push(i);
    }
  }
  while (queue.length > 0) {
    const v = queue.pop();
    const x = v % w;
    const y = (v - x) / w;
    for (const [dx, dy] of DIRS) {
      const from = at(x - dx, y - dy);
      const stand = at(x - 2 * dx, y - 2 * dy);
      if (from < 0 || stand < 0) continue;
      if (wall[from] === 1 || wall[stand] === 1) continue;
      if (live[from] === 1) continue;
      live[from] = 1;
      queue.push(from);
    }
  }
  return live;
}


/**
 * Whether the player can still reach the hallway square after a room's plan: a plan that ends with a box on the room's
 * door seals the player in, which is fine only for the last room the run visits.
 */
function canLeave(level, room, from, boxes) {
  const usable = new Uint8Array(level.wall.length);
  for (const c of room.cells) usable[c] = 1;
  usable[room.hall] = 1;
  const seen = new Uint8Array(level.wall.length);
  const buf = new Int32Array(4);
  if (usable[from] !== 1) return false;
  seen[from] = 1;
  const stack = [from];
  while (stack.length > 0) {
    const v = stack.pop();
    if (v === room.hall) return true;
    const count = neighbours(level, v, buf);
    for (let k = 0; k < count; k += 1) {
      const to = buf[k];
      if (usable[to] !== 1 || seen[to] === 1 || boxes[to] === 1) continue;
      seen[to] = 1;
      stack.push(to);
    }
  }
  return from === room.hall;
}

/**
 * One room's push-optimal plan, entered from its hallway square: BFS over push states, a state being the boxes plus the
 * smallest cell of the player's reachable region (the region is a function of the boxes, so one number names it).
 * Returns { pushes, moves } or null when no plan leaves every box of the room on a goal.
 */
export function planRoom(level, room, entry = room?.hall, live = liveSquares(level)) {
  const { width: w, wall, goal } = level;
  const size = wall.length;
  const cellSet = new Uint8Array(size);
  const usable = new Uint8Array(size);
  for (const c of room.cells) {
    cellSet[c] = 1;
    usable[c] = 1;
  }
  usable[room.hall] = 1;

  const startMap = new Uint8Array(size);
  for (const b of room.boxes) startMap[b] = 1;

  // Two buffers, never one: expanding a state asks for the next state's region while it is still reading its own,
  // and a single shared buffer would silently rewrite the region the rest of the loop is testing against.
  const reachable = new Uint8Array(size);
  const scratch = new Uint8Array(size);
  const buf = new Int32Array(4);
  /** Marks the cells reachable from `from` around `boxes` into `out`, and returns the smallest of them. */
  const regionFrom = (from, boxes, out) => {
    out.fill(0);
    if (usable[from] !== 1) return from;
    out[from] = 1;
    const stack = [from];
    let smallest = from;
    while (stack.length > 0) {
      const v = stack.pop();
      if (v < smallest) smallest = v;
      const count = neighbours(level, v, buf);
      for (let k = 0; k < count; k += 1) {
        const to = buf[k];
        if (usable[to] !== 1 || out[to] === 1 || boxes[to] === 1) continue;
        out[to] = 1;
        stack.push(to);
      }
    }
    return smallest;
  };

  const startBoxes = room.boxes.slice().sort((a, b) => a - b);
  const isSolved = (boxes) => boxes.every((b) => goal[b] === 1);
  if (isSolved(startBoxes)) return { pushes: 0, moves: '', closed: !canLeave(level, room, entry, startMap) };

  const states = [{ boxes: startBoxes, boxesMap: startMap, min: regionFrom(entry, startMap, reachable), parent: -1, push: null }];
  const seen = new Set([`${startBoxes.join(',')}|${states[0].min}`]);

  for (let head = 0; head < states.length; head += 1) {
    const state = states[head];
    // The reachable set must belong to this state's boxes: recompute it from a cell that is in it.
    regionFrom(state.min, state.boxesMap, reachable);
    for (let index = 0; index < state.boxes.length; index += 1) {
      const b = state.boxes[index];
      for (const [dx, dy, letter] of DIRS) {
        const d = dy * w + dx;
        const stand = b - d;
        const target = b + d;
        if (wall[stand] === 1 || state.boxesMap[stand] === 1 || reachable[stand] !== 1) continue;
        if (usable[target] !== 1 || wall[target] === 1 || state.boxesMap[target] === 1) continue;
        // A box never leaves its room: cellSet is the room's own floor, which excludes the hallway row.
        if (cellSet[target] !== 1) continue;
        // Sound pruning: a square from which no sequence of pushes, other boxes aside, ever reaches a goal. Unlike a
        // corner-or-edge test this is exact about a box pinned to a wall: it may still slide to a column where it can be
        // pushed away from the wall, and the live-square table knows that.
        if (live[target] !== 1) continue;

        const nextBoxes = state.boxes.slice();
        nextBoxes[index] = target;
        nextBoxes.sort((p, q) => p - q);
        const nextMap = state.boxesMap.slice();
        nextMap[b] = 0;
        nextMap[target] = 1;
        const nextMin = regionFrom(b, nextMap, scratch);
        const key = `${nextBoxes.join(',')}|${nextMin}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const push = { from: b, to: target, letter };
        states.push({ boxes: nextBoxes, boxesMap: nextMap, min: nextMin, parent: head, push });
        if (isSolved(nextBoxes)) {
          const plan = [];
          for (let s = states.length - 1; s > 0; s = states[s].parent) plan.push(states[s].push);
          plan.reverse();
          const route = movesFor(level, room, entry, room.boxes, plan);
          return { pushes: plan.length, moves: route.moves, closed: !canLeave(level, room, route.end, nextMap) };
        }
      }
    }
  }
  return null;
}

/** The LURD route for a list of pushes, walking the player to each push's standing cell first. */
function movesFor(level, room, entry, boxes, plan) {
  const { width: w, wall } = level;
  const usable = new Uint8Array(wall.length);
  for (const c of room.cells) usable[c] = 1;
  usable[room.hall] = 1;
  const boxAt = new Uint8Array(wall.length);
  for (const b of boxes) boxAt[b] = 1;
  const buf = new Int32Array(4);
  let player = entry;
  let out = '';

  const walkTo = (from, to) => {
    if (from === to) return '';
    const prev = new Int32Array(wall.length).fill(-2);
    const letter = new Array(wall.length).fill('');
    prev[from] = -1;
    const queue = [from];
    for (let head = 0; head < queue.length; head += 1) {
      const v = queue[head];
      if (v === to) break;
      const count = neighbours(level, v, buf);
      for (let k = 0; k < count; k += 1) {
        const nx = buf[k];
        if (usable[nx] !== 1 || boxAt[nx] === 1 || prev[nx] !== -2) continue;
        prev[nx] = v;
        letter[nx] = letterFrom(v, nx, w);
        queue.push(nx);
      }
    }
    if (prev[to] === -2) return null;
    let path = '';
    for (let v = to; prev[v] !== -1; v = prev[v]) path = letter[v] + path;
    return path;
  };

  for (const push of plan) {
    const d = push.to - push.from;
    const stand = push.from - d;
    const route = walkTo(player, stand);
    if (route === null) throw new Error(`no path to the standing cell ${stand}`);
    out += route + push.letter;
    boxAt[push.from] = 0;
    boxAt[push.to] = 1;
    player = push.from;
  }
  return { moves: out, end: player };
}

/** The walking route from `from` to `to` over the whole board, around every box, or null. */
function walkPath(level, from, to, boxesMap) {
  const { width: w, wall } = level;
  if (from === to) return '';
  const prev = new Int32Array(wall.length).fill(-2);
  const letter = new Array(wall.length).fill('');
  const buf = new Int32Array(4);
  prev[from] = -1;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const v = queue[head];
    if (v === to) break;
    const count = neighbours(level, v, buf);
    for (let k = 0; k < count; k += 1) {
      const nx = buf[k];
      if (wall[nx] === 1 || boxesMap[nx] === 1 || prev[nx] !== -2) continue;
      prev[nx] = v;
      letter[nx] = letterFrom(v, nx, w);
      queue.push(nx);
    }
  }
  if (prev[to] === -2) return null;
  let path = '';
  for (let v = to; prev[v] !== -1; v = prev[v]) path = letter[v] + path;
  return path;
}

/** Plays a room's route into the board mirror and returns where the player ends up. */
function replayRoom(level, entry, route, boxesMap) {
  const { width: w } = level;
  let player = entry;
  for (const ch of route) {
    const dir = DIRS.find((d) => d[2] === ch);
    const step = dir[1] * w + dir[0];
    const next = player + step;
    if (boxesMap[next] === 1) {
      boxesMap[next] = 0;
      boxesMap[next + step] = 1;
    }
    player = next;
  }
  return player;
}

/**
 * The level's answer. Each room's push-optimal plan is computed once; the rooms are then stitched in whatever order
 * lets the player actually walk between them, which matters because a room may end with a box on its own door and trap
 * the player inside — the plan is still push-optimal, but that order is a dead end, so the search backtracks over the
 * order (at most four rooms) instead of committing to it. Returns { moves, why, rooms, pushes }; moves is null only
 * when no order works, and then why says so.
 */
export function solve(levelText) {
  const level = parseLevel(levelText);
  const dec = decompose(level);
  if (dec.ok === false) return { moves: null, why: dec.why, rooms: 0, pushes: 0 };

  const live = liveSquares(level);
  const plans = new Map();
  for (const room of dec.rooms) plans.set(room, planRoom(level, room, room.hall, live));
  const hopeless = dec.rooms.filter((room) => plans.get(room) === null);
  if (hopeless.length > 0) {
    return { moves: null, why: `no plan for ${hopeless.length} room(s)`, rooms: 0, pushes: 0 };
  }

  const stitch = (remaining, player, boxesMap, moves, pushes, order) => {
    if (remaining.length === 0) return { moves, pushes, order };
    // Nearest room first, ties by door: deterministic, and it keeps the walking (never the pushes) short.
    const wanted = remaining
      .map((room) => ({ room, walk: walkPath(level, player, room.hall, boxesMap) }))
      .sort((a, b) => (a.walk === null ? Infinity : a.walk.length) - (b.walk === null ? Infinity : b.walk.length) || a.room.door - b.room.door);
    for (const { room, walk } of wanted) {
      if (walk === null) continue;
      const plan = plans.get(room);
      if (plan.closed === true && remaining.length > 1) continue;
      const nextBoxes = boxesMap.slice();
      const nextPlayer = replayRoom(level, room.hall, plan.moves, nextBoxes);
      const rest = remaining.filter((other) => other !== room);
      const result = stitch(rest, nextPlayer, nextBoxes, moves + walk + plan.moves, pushes + plan.pushes, [...order, plan.pushes]);
      if (result !== null) return result;
    }
    return null;
  };

  const result = stitch(dec.rooms.slice(), level.player, level.box.slice(), '', 0, []);
  if (result === null) return { moves: null, why: 'no room order lets the player walk between the rooms', rooms: 0, pushes: 0 };
  return { moves: result.moves, why: null, rooms: dec.rooms.length, pushes: result.pushes, order: result.order };
}
