import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  digestStatuses,
  MissingNightError,
  type DigestRow,
  type DigestStatus,
  type NightDigest,
  type StatusCounts,
} from './types.js';

type ParsedLine = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

function isStatus(value: unknown): value is DigestStatus {
  return typeof value === 'string' && (digestStatuses as readonly string[]).includes(value);
}

function parseLine(line: string): ParsedLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || typeof row.job !== 'string' || !isStatus(row.status)) return null;
  if (!('owner' in row) || (row.owner !== null && typeof row.owner !== 'string')) return null;
  if (row.error !== undefined && row.error !== null && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status,
    owner: row.owner,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

function emptyCounts(): StatusCounts {
  return { ok: 0, retry: 0, fail: 0 };
}

export function readNight(runsDir: string, night: string): NightDigest {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new MissingNightError(night);
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) throw new MissingNightError(night);

  const text = readFileSync(path, 'utf8');
  if (text.trim() === '') return { rows: [], badLines: 0, counts: emptyCounts() };

  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();

  const rows: DigestRow[] = [];
  const counts = emptyCounts();
  let badLines = 0;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const row = rows.find((item) => item.job === parsed.job);
    if (!row) {
      rows.push({
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    row.runs += 1;
    if (parsed.status === 'retry') row.retries += 1;
    if (parsed.at < row.firstAt) row.firstAt = parsed.at;
    if (parsed.at >= row.lastAt) {
      row.lastAt = parsed.at;
      row.lastStatus = parsed.status;
      row.lastError = parsed.error;
      row.owner = parsed.owner;
    }
  }

  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines, counts };
}
