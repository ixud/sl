/**
 * launch.mjs — เปิด Console ครั้งเดียว: ใช้ตัวที่รันอยู่ หรือ spawn แบบ detached
 * ไม่ผูก terminal: index.mjs ถูก spawn ด้วย windowsHide + stdio ignore + unref
 */
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SERVER_DIR, ROOT } from './env.mjs';

export const PORTS = [4310, 4311];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlOf = (port) => `http://127.0.0.1:${Number(port)}/`;

/** listener นี้คือ Console ของเราจริงไหม — ดู app.root/app.port จาก /api/state */
export function probe(port, { timeout = 3000 } = {}) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/state', timeout }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const app = JSON.parse(body)?.app;
          resolve(!!app && app.root === ROOT && Number(app.port) === Number(port) && typeof app.version === 'string');
        } catch { resolve(false); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

export async function findConsole(ports = PORTS, { probeFn = probe } = {}) {
  for (const port of ports) if (await probeFn(port)) return port;
  return null;
}

export function openBrowser(url) {
  const child = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref?.();
}

export async function launch({
  ports = PORTS, indexPath = path.join(SERVER_DIR, 'index.mjs'), node = process.execPath,
  probeFn = probe, spawnFn = spawn, openFn = openBrowser, sleepFn = sleep,
  timeoutMs = 20000, stepMs = 250, now = Date.now, log = console.log, err = console.error,
} = {}) {
  const existing = await findConsole(ports, { probeFn });
  if (existing) { openFn(urlOf(existing)); log(`BAZER_PORT=${existing}`); return 0; }

  const child = spawnFn(node, [indexPath, '--no-open', `--port=${ports[0]}`], {
    detached: true, windowsHide: true, stdio: 'ignore', cwd: ROOT,
  });
  child.unref?.();

  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await sleepFn(stepMs);
    const found = await findConsole(ports, { probeFn });
    if (found) { openFn(urlOf(found)); log(`BAZER_PORT=${found}`); return 0; }
  }
  err('เปิดคอนโซลไม่สำเร็จภายใน 20 วินาที — ตรวจว่า node ทำงานได้');
  return 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) launch().then((code) => { process.exitCode = code; });
