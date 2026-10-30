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

  it('is pending while an undo runs, ignores a second one meanwhile and tells subscribers', async () => {
    const history = new UndoHistory();
    let finish!: () => void;
    const reverse = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    history.record({ ...entry(1, 'first'), reverse });
    const listener = vi.fn();
    const unsubscribe = history.subscribe(listener);

    const first = history.undo();
    expect(history.pending).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(await history.undo()).toBeUndefined();
    expect(await history.redo()).toBeUndefined();
    expect(reverse).toHaveBeenCalledTimes(1);

    listener.mockClear();
    finish();
    expect((await first)?.recordId).toBe(1);
    expect(history.pending).toBe(false);
    expect(history.redoDescription()).toBe('first');
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    history.record(entry(2, 'second'));
    expect(listener).not.toHaveBeenCalled();
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

  describe('failed effects', () => {
    const discard = () => true;
    const retry = () => false;
    const failOnce = () => vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

    it('leaves both lists unchanged when a failed undo should be retried', async () => {
      const history = new UndoHistory();
      history.record(entry(1, 'first'));
      history.record(entry(2, 'second'));
      history.record({ ...entry(3, 'third'), reverse: failOnce() });
      await history.undo().catch(() => undefined); // the one failure
      await history.undo(); // third
      await history.redo(); // third again, so the redo list is not empty
      history.record({ ...entry(4, 'fourth'), reverse: failOnce() });
      history.record({ ...entry(5, 'fifth'), reverse: failOnce() });

      await expect(history.undo(retry)).rejects.toThrow('boom');
      expect(history.undoDescription()).toBe('fifth');
      expect(history.redoDescription()).toBeUndefined();
    });

    it('drops only the failing entry when a failed undo should be discarded', async () => {
      const history = new UndoHistory();
      history.record(entry(1, 'first'));
      history.record({ ...entry(2, 'second'), reverse: failOnce() });
      history.record(entry(3, 'third'));
      await history.undo();

      await expect(history.undo(discard)).rejects.toThrow('boom');
      expect(history.undoDescription()).toBe('first');
      expect(history.redoDescription()).toBe('third');
      expect((await history.undo())?.recordId).toBe(1);
      expect(await history.undo()).toBeUndefined();
    });

    it('leaves both lists unchanged when a failed redo should be retried', async () => {
      const history = new UndoHistory();
      history.record({ ...entry(1, 'first'), reapply: failOnce() });
      await history.undo();

      await expect(history.redo(retry)).rejects.toThrow('boom');
      expect(history.redoDescription()).toBe('first');
      expect(history.undoDescription()).toBeUndefined();
    });

    it('drops only the failing entry when a failed redo should be discarded', async () => {
      const history = new UndoHistory();
      history.record(entry(1, 'first'));
      history.record({ ...entry(2, 'second'), reapply: failOnce() });
      history.record(entry(3, 'third'));
      await history.undo();
      await history.undo();
      await history.undo();

      // redo list, newest first: first, second, third
      await history.redo();
      await expect(history.redo(discard)).rejects.toThrow('boom');
      expect(history.undoDescription()).toBe('first');
      expect(history.redoDescription()).toBe('third');
      expect((await history.redo())?.recordId).toBe(3);
      expect(await history.redo()).toBeUndefined();
    });
  });

  describe('re-created records', () => {
    // A fake record store: create hands out new ids, remove forgets them.
    const store = () => {
      let next = 100;
      const log: string[] = [];
      const edit = (id: number): UndoEntry => ({
        recordId: id,
        description: `edit ${id}`,
        reverse: (current) => {
          log.push(`update ${current} back`);
          return Promise.resolve();
        },
        reapply: (current) => {
          log.push(`update ${current} again`);
          return Promise.resolve();
        },
      });
      const deletion = (id: number): UndoEntry => ({
        recordId: id,
        description: `delete ${id}`,
        reverse: () => {
          log.push('create');
          return Promise.resolve(next++);
        },
        reapply: (current) => {
          log.push(`remove ${current}`);
          return Promise.resolve();
        },
      });
      return { log, edit, deletion };
    };

    it('points earlier entries at the new id after undoing a delete', async () => {
      const { log, edit, deletion } = store();
      const history = new UndoHistory();
      history.record(edit(5));
      history.record(deletion(5));

      await history.undo();
      await history.undo();
      expect(log).toEqual(['create', 'update 100 back']);

      await history.redo();
      expect(log.at(-1)).toBe('update 100 again');
    });

    it('follows the Record through repeated re-creation, in done and undone entries', async () => {
      const { log, edit, deletion } = store();
      const history = new UndoHistory();
      history.record(edit(5));
      history.record(deletion(5));

      await history.undo(); // re-created as 100
      await history.undo(); // edit undone on 100
      await history.redo(); // edit redone on 100
      await history.redo(); // delete redone on 100
      await history.undo(); // re-created again as 101
      expect(log).toEqual(['create', 'update 100 back', 'update 100 again', 'remove 100', 'create']);

      await history.undo();
      await history.redo();
      expect(log.slice(-2)).toEqual(['update 101 back', 'update 101 again']);
    });

    it('remaps entries waiting in the undone list when a Record is re-created', async () => {
      const { log, edit, deletion } = store();
      const history = new UndoHistory();
      history.record(edit(5));
      history.record(deletion(5));
      await history.undo(); // 100; both entries now point at 100
      await history.undo(); // edit sits in undone
      await history.redo();
      await history.redo(); // delete redone on 100
      await history.undo(); // 101: the edit is in done, the delete in undone
      await history.undo();
      expect(log.at(-1)).toBe('update 101 back');
      expect((await history.redo())?.recordId).toBe(101);
    });

    it('leaves entries for other Records untouched', async () => {
      const { log, edit, deletion } = store();
      const history = new UndoHistory();
      history.record(edit(7));
      history.record(edit(5));
      history.record(deletion(5));

      await history.undo();
      await history.undo();
      await history.undo();
      expect(log).toEqual(['create', 'update 100 back', 'update 7 back']);
    });
  });
});
