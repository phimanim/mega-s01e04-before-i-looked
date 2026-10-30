export const digestStatuses = ['ok', 'retry', 'fail'] as const;

export type DigestStatus = (typeof digestStatuses)[number];

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type StatusCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
  counts: StatusCounts;
};

export class MissingNightError extends Error {
  readonly night: string;

  constructor(night: string) {
    super(`no run log for ${night}`);
    this.name = 'MissingNightError';
    this.night = night;
  }
}

// Implemented in read.ts. Rows come back sorted by job.
// A missing file throws MissingNightError. A bad line is counted, never thrown.
export { readNight } from './read.js';
