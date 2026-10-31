/* Shared process slot: shape repair + diagnostics never throw. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const KEY = Symbol.for('bazer.flow.shared');
const load = () => import('./shared.mjs');

test('S1 empty slot -> full shape, hook recorded once', async () => {
  delete globalThis[KEY];
  const { sharedState, recordHook } = await load();
  const g = sharedState();
  assert.ok(g.hooks instanceof Set && g.evt instanceof Map && typeof g.flow === 'object');
  assert.equal(recordHook('x'), true);
  assert.equal(recordHook('x'), false);
  assert.equal(sharedState().hooks.has('x'), true);
});

test('S2 object without hooks/evt/flow is filled in place, extra fields kept', async () => {
  globalThis[KEY] = { foo: 1, ladderSrc: 7 };
  const { sharedState } = await load();
  const g = sharedState();
  assert.ok(g.hooks instanceof Set && g.evt instanceof Map && typeof g.flow === 'object');
  assert.equal(g.foo, 1);
  assert.equal(g.ladderSrc, 7);
  assert.equal(sharedState(), g, 'same object repaired in place');
});

test('S3 wrong field types are replaced', async () => {
  globalThis[KEY] = { hooks: [], evt: null, flow: 'x' };
  const { sharedState } = await load();
  const g = sharedState();
  assert.ok(g.hooks instanceof Set);
  assert.ok(g.evt instanceof Map);
  assert.deepEqual(g.flow, {});
});

test('S4 recordHook never propagates even when hooks.has throws', async () => {
  const g = { hooks: new Set() };
  g.hooks.has = () => { throw new Error('boom'); };
  globalThis[KEY] = g;
  const { recordHook } = await load();
  assert.doesNotThrow(() => recordHook('x'));
  assert.equal(recordHook('x'), false);
});

test('S5 two writers in either order keep both shapes', async () => {
  const { sharedState, sharedBox, recordHook } = await load();
  globalThis[KEY] = {};
  assert.doesNotThrow(() => sharedState());
  assert.doesNotThrow(() => sharedBox());
  assert.equal(recordHook('a'), true);
  globalThis[KEY] = { checks: new Set() };
  const g = sharedState();
  const b = sharedBox();
  assert.equal(g, b);
  assert.ok(g.checks instanceof Set && g.hooks instanceof Set);
  assert.equal(g.other, undefined);
});

test('S6 index uses the shared helper for hookSeen', () => {
  const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/shared\.mjs'/);
  assert.match(src, /function hookSeen\(name\)/);
  assert.match(src, /recordHook\(name\)/);
  assert.match(src, /function hookSeen\(name\) \{\s*try \{/);
  assert.equal(src.includes('globalThis[GKEY]'), false);
});
