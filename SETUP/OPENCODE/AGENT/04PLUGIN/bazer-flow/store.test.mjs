/* bazer-flow store — temp-dir only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fsStore, ringLog, pruneState, loadSpecFile } from './store.mjs';
import { pathToFileURL } from 'node:url';

const spec = JSON.parse(fs.readFileSync(new URL('./flow.spec.json', import.meta.url), 'utf8'));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bazer-store-'));

test('set/get round-trips and leaves no temp file behind', () => {
  const dir = tmp();
  const store = fsStore(dir);
  assert.equal(store.set('C:\\Users\\bazer.runtime', { a: 1 }), true);
  assert.deepEqual(store.get('C:\\Users\\bazer.runtime'), { a: 1 });
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.equal(files.some((n) => n.includes('.tmp-')), false);
});

test('missing key and corrupt json both read as null', () => {
  const dir = tmp();
  const store = fsStore(dir);
  assert.equal(store.get('absent'), null);
  fs.writeFileSync(path.join(dir, 'broken.json'), '{oops', 'utf8');
  assert.equal(store.get('broken'), null);
});

test('del removes the key and never throws on a missing dir', () => {
  const dir = tmp();
  const store = fsStore(dir);
  store.set('k', { v: 1 });
  store.del('k');
  assert.equal(store.get('k'), null);
  const ghost = fsStore(path.join(dir, 'no', 'such', 'dir'));
  assert.equal(ghost.get('k'), null);
  assert.doesNotThrow(() => ghost.del('k'));
});

test('badge writes a plain text file next to state', () => {
  const dir = tmp();
  const store = fsStore(dir);
  store.badge('session-1', 'P3 ARENA');
  assert.equal(fs.readFileSync(path.join(dir, 'badge-session-1.txt'), 'utf8'), 'P3 ARENA');
});

test('ringLog caps at maxLines and keeps the newest lines', () => {
  const dir = tmp();
  const file = path.join(dir, 'log.tsv');
  const log = ringLog(file, 3);
  for (let i = 1; i <= 6; i++) log({ n: i });
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => JSON.parse(l).n), [4, 5, 6]);
});

test('pruneState drops old state files, keeps fresh ones and badges', () => {
  const dir = tmp();
  const store = fsStore(dir);
  const now = Date.now();
  store.set('old', { v: 1 });
  store.set('fresh', { v: 2 });
  store.badge('fresh', 'P0');
  const oldFile = path.join(dir, 'old.json');
  const stamp = new Date(now - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldFile, stamp, stamp);
  pruneState(dir, 7 * 24 * 60 * 60 * 1000, now);
  assert.equal(fs.existsSync(oldFile), false);
  assert.deepEqual(store.get('fresh'), { v: 2 });
  assert.equal(fs.existsSync(path.join(dir, 'badge-fresh.txt')), true);
});

test('pruneState on a missing directory never throws', () => {
  assert.doesNotThrow(() => pruneState(path.join(os.tmpdir(), 'bazer-nope-' + Date.now()), 1000, Date.now()));
});

test('U96 ringLog keeps 1500 lines and the 1500-line rewrite stays fast', () => {
  const dir = tmp();
  const file = path.join(dir, 'log.tsv');
  const log = ringLog(file, 1500);
  fs.writeFileSync(file, Array.from({ length: 1499 }, (_, i) => JSON.stringify({ n: i })).join('\n') + '\n', 'utf8');
  const t0 = Date.now();
  log({ n: 1499 });
  const ms = Date.now() - t0;
  console.log('ringLog 1500-line rewrite ms: ' + ms);
  assert.ok(ms < 1000, 'rewrite took ' + ms + ' ms');
  log({ n: 1500 });
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1500);
  assert.equal(JSON.parse(lines[0]).n, 1);
  assert.equal(JSON.parse(lines[lines.length - 1]).n, 1500);
});

test('loadSpecFile works from a copied dir whose path has spaces and Thai chars', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bazer plugin ไทย test '));
  const dir = path.join(root, 'bazer flow ไทย');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(new URL('./store.mjs', import.meta.url), path.join(dir, 'store.mjs'));
    fs.copyFileSync(new URL('./flow.spec.json', import.meta.url), path.join(dir, 'flow.spec.json'));
    const copyUrl = pathToFileURL(path.join(dir, 'store.mjs')).href;
    const mod = await import(copyUrl);
    const specUrl = new URL('./flow.spec.json', copyUrl);
    assert.deepEqual(mod.loadSpecFile(specUrl), spec);
    assert.deepEqual(mod.loadSpecFile(path.join(dir, 'flow.spec.json')), spec);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

