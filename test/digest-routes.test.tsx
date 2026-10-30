import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

function appWith(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function nightDir(body: string) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(dir, '2026-10-28.jsonl'), body);
  return dir;
}

const twoJobs = [
  '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
].join('\n');

describe('digest routes', () => {
  it('returns 200 and the same jobs in the same order', async () => {
    const app = appWith(nightDir(twoJobs));
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    const json = await app.request('/api/digest/2026-10-28');
    expect(json.status).toBe(200);
    const body = (await json.json()) as NightDigest;
    expect(body.rows.map((row) => row.job)).toEqual(['lane/sync', 'rig/rotate-logs']);
    let cursor = 0;
    for (const job of body.rows.map((row) => row.job)) {
      const at = html.indexOf(job, cursor);
      expect(at).toBeGreaterThan(-1);
      cursor = at + job.length;
    }
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    const app = appWith(dir);
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const app = appWith(nightDir(''));
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as NightDigest;
    expect(body.rows).toEqual([]);
  });

  it('renders a night that contains a bad line', async () => {
    const app = appWith(
      nightDir(
        '{"at":"2026-10-28T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}\nnot json\n',
      ),
    );
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('rig/rotate-logs');
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as NightDigest;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual(['rig/rotate-logs']);
  });
});
