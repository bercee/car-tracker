import { describe, expect, it, vi } from 'vitest';
import { UndoHistory, type UndoEntry } from '../../src/undoHistory';

const entry = (recordId: number, description: string, log: string[] = []): UndoEntry => ({
  recordId,
  description,
  reverse: () => {
    log.push(`reverse ${description}`);
    return Promise.resolve();
  },
  reapply: () => {
    log.push(`reapply ${description}`);
    return Promise.resolve();
  },
});

describe('undo history', () => {
  it('has nothing to undo or redo when empty', async () => {
    const history = new UndoHistory();
    expect(history.undoDescription()).toBeUndefined();
    expect(history.redoDescription()).toBeUndefined();
    expect(await history.undo()).toBeUndefined();
    expect(await history.redo()).toBeUndefined();
  });

  it('undoes and redoes entries in order, newest first', async () => {
    const log: string[] = [];
    const history = new UndoHistory();
    history.record(entry(1, 'first', log));
    history.record(entry(2, 'second', log));
    history.record(entry(3, 'third', log));

    expect((await history.undo())?.recordId).toBe(3);
    expect((await history.undo())?.recordId).toBe(2);
    expect((await history.redo())?.recordId).toBe(2);
    expect((await history.undo())?.recordId).toBe(2);
    expect((await history.undo())?.recordId).toBe(1);
    expect(await history.undo()).toBeUndefined();
    expect((await history.redo())?.recordId).toBe(1);
    expect((await history.redo())?.recordId).toBe(2);
    expect((await history.redo())?.recordId).toBe(3);
    expect(await history.redo()).toBeUndefined();
    expect(log).toEqual([
      'reverse third',
      'reverse second',
      'reapply second',
      'reverse second',
      'reverse first',
      'reapply first',
      'reapply second',
      'reapply third',
    ]);
  });

  it('reports the description of the next undo and the next redo', async () => {
    const history = new UndoHistory();
    history.record(entry(1, 'first'));
    history.record(entry(2, 'second'));
    expect(history.undoDescription()).toBe('second');
    expect(history.redoDescription()).toBeUndefined();

    await history.undo();
    expect(history.undoDescription()).toBe('first');
    expect(history.redoDescription()).toBe('second');

    await history.undo();
    expect(history.undoDescription()).toBeUndefined();
    expect(history.redoDescription()).toBe('first');
  });

  it('clears redo when a new entry is recorded', async () => {
    const history = new UndoHistory();
    history.record(entry(1, 'first'));
    history.record(entry(2, 'second'));
    await history.undo();
    expect(history.redoDescription()).toBe('second');

    history.record(entry(3, 'third'));
    expect(history.redoDescription()).toBeUndefined();
    expect(await history.redo()).toBeUndefined();
    expect(history.undoDescription()).toBe('third');
  });

  it('keeps an entry where it was when its effect fails', async () => {
    const history = new UndoHistory();
    const failing = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    history.record({ ...entry(1, 'first'), reverse: failing });

    await expect(history.undo()).rejects.toThrow('boom');
    expect(history.undoDescription()).toBe('first');
    expect(history.redoDescription()).toBeUndefined();

    expect((await history.undo())?.recordId).toBe(1);
    expect(history.redoDescription()).toBe('first');
  });
});
