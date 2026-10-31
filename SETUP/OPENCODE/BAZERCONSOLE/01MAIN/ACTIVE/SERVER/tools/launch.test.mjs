import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, probe, findConsole, PORTS } from '../launch.mjs';
import { ROOT } from '../env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WINDOWS = path.resolve(HERE, '..', '..', '..', '..', '03WINDOWS');

async function fakeConsole(app, port = 0) {
  const srv = http.createServer((req, res) => {
    if (req.url.split('?')[0] !== '/api/state') { res.writeHead(404); return res.end('no'); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ app }));
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  return srv;
}
const close = (srv) => new Promise((r) => srv.close(r));
async function freePort() {
  const srv = await fakeConsole({});
  const port = srv.address().port;
  await close(srv);
  return port;
}

test('found: opens the existing console once and starts nothing', async (t) => {
  const app = { version: '0.1.0', root: ROOT, port: 0 };
  const srv = await fakeConsole(app);
  t.after(() => close(srv));
  app.port = srv.address().port;
  const opens = [];
  let spawned = 0;
  const code = await launch({
    ports: [app.port], probeFn: probe, openFn: (u) => opens.push(u),
    spawnFn: () => { spawned++; throw new Error('must not spawn'); }, timeoutMs: 500, log: () => {},
  });
  assert.equal(code, 0);
  assert.equal(spawned, 0);
  assert.deepEqual(opens, [`http://127.0.0.1:${app.port}/`]);
  assert.match(opens[0], /^http:\/\/127\.0\.0\.1:\d+\/$/);
});

test('not found: spawns detached once, polls until the fake answers, opens once', async (t) => {
  const port = await freePort();
  let srv = null;
  t.after(() => (srv ? close(srv) : Promise.resolve()));
  let spawns = 0, unrefs = 0;
  const opens = [];
  const code = await launch({
    ports: [port], indexPath: 'C:\\fake\\index.mjs', probeFn: probe,
    spawnFn: (file, args, opts) => {
      spawns++;
      assert.equal(file, process.execPath);
      assert.deepEqual(args, ['C:\\fake\\index.mjs', '--no-open', `--port=${port}`]);
      assert.equal(opts.detached, true);
      assert.equal(opts.windowsHide, true);
      assert.equal(opts.stdio, 'ignore');
      assert.equal(opts.cwd, ROOT);
      const app = { version: '0.1.0', root: ROOT, port };
      fakeConsole(app, port).then((s) => { srv = s; });
      return { unref: () => { unrefs++; } };
    },
    openFn: (u) => opens.push(u), sleepFn: (ms) => new Promise((r) => setTimeout(r, 25)),
    timeoutMs: 3000, stepMs: 25, log: () => {},
  });
  assert.equal(code, 0);
  assert.equal(spawns, 1);
  assert.equal(unrefs, 1);
  assert.deepEqual(opens, [`http://127.0.0.1:${port}/`]);
});

test('timeout: exits 1, one Thai line, no browser, no extra spawn', async () => {
  const opens = [], errs = [];
  let spawns = 0;
  const code = await launch({
    ports: [65001], probeFn: async () => false,
    spawnFn: () => { spawns++; return { unref: () => {} }; },
    openFn: (u) => opens.push(u), timeoutMs: 0, log: () => {}, err: (m) => errs.push(m),
  });
  assert.equal(code, 1);
  assert.equal(spawns, 1);
  assert.equal(opens.length, 0);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /20 วินาที/);
});

test('foreign listener on the same port is not our console', async (t) => {
  const app = { version: '9.9.9', root: path.resolve('C:\\Other\\Place'), port: 0 };
  const srv = await fakeConsole(app);
  t.after(() => close(srv));
  app.port = srv.address().port;
  assert.equal(await probe(app.port), false);
  assert.equal(await findConsole([app.port], { probeFn: probe }), null);
  let spawns = 0;
  const code = await launch({
    ports: [app.port], probeFn: probe, openFn: () => { throw new Error('must not open'); },
    spawnFn: () => { spawns++; return { unref: () => {} }; }, timeoutMs: 0, log: () => {}, err: () => {},
  });
  assert.equal(code, 1);
  assert.equal(spawns, 1);
});

test('wrappers: VBS is hidden and runs launch.mjs; CMD prints one line and exits /b', () => {
  assert.deepEqual(PORTS, [4310, 4311]);
  const vbs = fs.readFileSync(path.join(WINDOWS, 'BAZER CONSOLE.vbs'), 'utf8');
  assert.match(vbs, /SERVER\\launch\.mjs/);
  assert.match(vbs, /sh\.Run\(cmd, 0, True\)/);
  assert.doesNotMatch(vbs, /index\.mjs/);
  assert.doesNotMatch(vbs, /taskkill|Stop-Process/i);
  const cmd = fs.readFileSync(path.join(WINDOWS, 'launch.cmd'), 'utf8');
  assert.match(cmd, /SERVER\\launch\.mjs/);
  assert.match(cmd, /คอนโซลเปิดแล้ว \(พอร์ต %PORT%\) ปิดหน้าต่างนี้ได้/);
  assert.match(cmd, /exit \/b\s*$/);
  assert.doesNotMatch(cmd, /taskkill|Stop-Process/i);
});

test('probe identifies our console from /api/state app.root/app.port', () => {
  const launchSrc = fs.readFileSync(path.resolve(HERE, '..', 'launch.mjs'), 'utf8');
  assert.match(launchSrc, /path: '\/api\/state'/);
  const src = fs.readFileSync(path.resolve(HERE, '..', 'index.mjs'), 'utf8');
  assert.match(src, /root: ROOT/);
  assert.match(src, /port: server\.address\(\)\?\.port \|\| PORT/);
});
