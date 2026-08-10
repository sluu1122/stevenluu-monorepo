import { beforeEach, describe, expect, it } from 'vitest';
import { clearGridScrollMemory, recallGridScroll, rememberGridScroll } from './gridScrollMemory';

beforeEach(() => {
  clearGridScrollMemory();
});

describe('grid scroll memory', () => {
  it('has nothing to recall before anything has been remembered', () => {
    expect(recallGridScroll('scenario-1|2026-08-07T00:00:00.000Z')).toBeNull();
  });

  it('hands the offset back for the revision it was taken at', () => {
    const revision = 'scenario-1|2026-08-07T00:00:00.000Z';
    rememberGridScroll(revision, { top: 420, left: 1200 });
    expect(recallGridScroll(revision)).toEqual({ top: 420, left: 1200 });
  });

  it('forgets the offset once a save has bumped the revision', () => {
    rememberGridScroll('scenario-1|2026-08-07T00:00:00.000Z', { top: 420, left: 1200 });
    // Same scenario, later updatedAt - every number in the grid has been
    // recomputed, so the row that offset pointed at has moved.
    expect(recallGridScroll('scenario-1|2026-08-07T09:30:00.000Z')).toBeNull();
  });

  it('does not leak one scenario\'s offset into another', () => {
    rememberGridScroll('scenario-1|2026-08-07T00:00:00.000Z', { top: 420, left: 1200 });
    expect(recallGridScroll('scenario-2|2026-08-07T00:00:00.000Z')).toBeNull();
  });

  it('keeps only the most recent offset for a revision', () => {
    const revision = 'scenario-1|2026-08-07T00:00:00.000Z';
    rememberGridScroll(revision, { top: 100, left: 0 });
    rememberGridScroll(revision, { top: 880, left: 640 });
    expect(recallGridScroll(revision)).toEqual({ top: 880, left: 640 });
  });

  it('recalls a copy, so a caller mutating what it got back cannot corrupt the store', () => {
    const revision = 'scenario-1|2026-08-07T00:00:00.000Z';
    rememberGridScroll(revision, { top: 420, left: 1200 });
    const first = recallGridScroll(revision)!;
    first.top = 0;
    expect(recallGridScroll(revision)).toEqual({ top: 420, left: 1200 });
  });
});
