import { describe, expect, it, vi } from 'vitest';
import { UndoHistory, type RecordAction } from '../../src/undoHistory';

const action = (recordId: number, label: string, log: string[] = []): RecordAction => ({
  recordId,
  label,
  eventDate: '2026-10-12',
  reverse: () => {
    log.push(`reverse ${label}`);
    return Promise.resolve();
  },
  reapply: () => {
    log.push(`reapply ${label}`);
    return Promise.resolve();
  },
});

describe('Undo history', () => {
  it('has nothing to undo or redo when empty', async () => {
    const undoHistory = new UndoHistory();
    expect(undoHistory.nextUndo()).toBeUndefined();
    expect(undoHistory.nextRedo()).toBeUndefined();
    expect(await undoHistory.undo()).toBeUndefined();
    expect(await undoHistory.redo()).toBeUndefined();
  });

  it('undoes and redoes Record actions in order, newest first', async () => {
    const log: string[] = [];
    const undoHistory = new UndoHistory();
    undoHistory.record(action(1, 'first', log));
    undoHistory.record(action(2, 'second', log));
    undoHistory.record(action(3, 'third', log));

    expect((await undoHistory.undo())?.recordId).toBe(3);
    expect((await undoHistory.undo())?.recordId).toBe(2);
    expect((await undoHistory.redo())?.recordId).toBe(2);
    expect((await undoHistory.undo())?.recordId).toBe(2);
    expect((await undoHistory.undo())?.recordId).toBe(1);
    expect(await undoHistory.undo()).toBeUndefined();
    expect((await undoHistory.redo())?.recordId).toBe(1);
    expect((await undoHistory.redo())?.recordId).toBe(2);
    expect((await undoHistory.redo())?.recordId).toBe(3);
    expect(await undoHistory.redo()).toBeUndefined();
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

  it('reports the next Record action to undo and to redo', async () => {
    const undoHistory = new UndoHistory();
    undoHistory.record(action(1, 'first'));
    undoHistory.record(action(2, 'second'));
    expect(undoHistory.nextUndo()?.label).toBe('second');
    expect(undoHistory.nextRedo()?.label).toBeUndefined();

    await undoHistory.undo();
    expect(undoHistory.nextUndo()?.label).toBe('first');
    expect(undoHistory.nextRedo()?.label).toBe('second');

    await undoHistory.undo();
    expect(undoHistory.nextUndo()?.label).toBeUndefined();
    expect(undoHistory.nextRedo()?.label).toBe('first');
  });

  it('clears redo when a new Record action is recorded', async () => {
    const undoHistory = new UndoHistory();
    undoHistory.record(action(1, 'first'));
    undoHistory.record(action(2, 'second'));
    await undoHistory.undo();
    expect(undoHistory.nextRedo()?.label).toBe('second');

    undoHistory.record(action(3, 'third'));
    expect(undoHistory.nextRedo()?.label).toBeUndefined();
    expect(await undoHistory.redo()).toBeUndefined();
    expect(undoHistory.nextUndo()?.label).toBe('third');
  });

  it('is pending while an undo runs, ignores a second one meanwhile and tells subscribers', async () => {
    const undoHistory = new UndoHistory();
    let finish!: () => void;
    const reverse = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    undoHistory.record({ ...action(1, 'first'), reverse });
    const listener = vi.fn();
    const unsubscribe = undoHistory.subscribe(listener);

    const first = undoHistory.undo();
    expect(undoHistory.pending).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(await undoHistory.undo()).toBeUndefined();
    expect(await undoHistory.redo()).toBeUndefined();
    expect(reverse).toHaveBeenCalledTimes(1);

    listener.mockClear();
    finish();
    expect((await first)?.recordId).toBe(1);
    expect(undoHistory.pending).toBe(false);
    expect(undoHistory.nextRedo()?.label).toBe('first');
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    undoHistory.record(action(2, 'second'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps a Record action where it was when its effect fails', async () => {
    const undoHistory = new UndoHistory();
    const failing = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    undoHistory.record({ ...action(1, 'first'), reverse: failing });

    await expect(undoHistory.undo()).rejects.toThrow('boom');
    expect(undoHistory.nextUndo()?.label).toBe('first');
    expect(undoHistory.nextRedo()?.label).toBeUndefined();

    expect((await undoHistory.undo())?.recordId).toBe(1);
    expect(undoHistory.nextRedo()?.label).toBe('first');
  });

  describe('failed effects', () => {
    const discard = () => true;
    const retry = () => false;
    const failOnce = () => vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

    it('leaves both lists unchanged when a failed undo should be retried', async () => {
      const undoHistory = new UndoHistory();
      undoHistory.record(action(1, 'first'));
      undoHistory.record(action(2, 'second'));
      undoHistory.record({ ...action(3, 'third'), reverse: failOnce() });
      await undoHistory.undo().catch(() => undefined); // the one failure
      await undoHistory.undo(); // third
      await undoHistory.redo(); // third again, so the redo list is not empty
      undoHistory.record({ ...action(4, 'fourth'), reverse: failOnce() });
      undoHistory.record({ ...action(5, 'fifth'), reverse: failOnce() });

      await expect(undoHistory.undo(retry)).rejects.toThrow('boom');
      expect(undoHistory.nextUndo()?.label).toBe('fifth');
      expect(undoHistory.nextRedo()?.label).toBeUndefined();
    });

    it('drops only the failing Record action when a failed undo should be discarded', async () => {
      const undoHistory = new UndoHistory();
      undoHistory.record(action(1, 'first'));
      undoHistory.record({ ...action(2, 'second'), reverse: failOnce() });
      undoHistory.record(action(3, 'third'));
      await undoHistory.undo();

      await expect(undoHistory.undo(discard)).rejects.toThrow('boom');
      expect(undoHistory.nextUndo()?.label).toBe('first');
      expect(undoHistory.nextRedo()?.label).toBe('third');
      expect((await undoHistory.undo())?.recordId).toBe(1);
      expect(await undoHistory.undo()).toBeUndefined();
    });

    it('leaves both lists unchanged when a failed redo should be retried', async () => {
      const undoHistory = new UndoHistory();
      undoHistory.record({ ...action(1, 'first'), reapply: failOnce() });
      await undoHistory.undo();

      await expect(undoHistory.redo(retry)).rejects.toThrow('boom');
      expect(undoHistory.nextRedo()?.label).toBe('first');
      expect(undoHistory.nextUndo()?.label).toBeUndefined();
    });

    it('drops only the failing Record action when a failed redo should be discarded', async () => {
      const undoHistory = new UndoHistory();
      undoHistory.record(action(1, 'first'));
      undoHistory.record({ ...action(2, 'second'), reapply: failOnce() });
      undoHistory.record(action(3, 'third'));
      await undoHistory.undo();
      await undoHistory.undo();
      await undoHistory.undo();

      // redo list, newest first: first, second, third
      await undoHistory.redo();
      await expect(undoHistory.redo(discard)).rejects.toThrow('boom');
      expect(undoHistory.nextUndo()?.label).toBe('first');
      expect(undoHistory.nextRedo()?.label).toBe('third');
      expect((await undoHistory.redo())?.recordId).toBe(3);
      expect(await undoHistory.redo()).toBeUndefined();
    });
  });

  describe('re-created records', () => {
    // A fake record store: create hands out new ids, remove forgets them.
    const store = () => {
      let next = 100;
      const log: string[] = [];
      const edit = (id: number): RecordAction => ({
        recordId: id,
        label: `edit ${id}`,
        eventDate: '2026-10-12',
        reverse: (current) => {
          log.push(`update ${current} back`);
          return Promise.resolve();
        },
        reapply: (current) => {
          log.push(`update ${current} again`);
          return Promise.resolve();
        },
      });
      const deletion = (id: number): RecordAction => ({
        recordId: id,
        label: `delete ${id}`,
        eventDate: '2026-10-12',
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

    it('points earlier Record actions at the new id after undoing a delete', async () => {
      const { log, edit, deletion } = store();
      const undoHistory = new UndoHistory();
      undoHistory.record(edit(5));
      undoHistory.record(deletion(5));

      await undoHistory.undo();
      await undoHistory.undo();
      expect(log).toEqual(['create', 'update 100 back']);

      await undoHistory.redo();
      expect(log.at(-1)).toBe('update 100 again');
    });

    it('follows the Record through repeated re-creation, in done and undone Record actions', async () => {
      const { log, edit, deletion } = store();
      const undoHistory = new UndoHistory();
      undoHistory.record(edit(5));
      undoHistory.record(deletion(5));

      await undoHistory.undo(); // re-created as 100
      await undoHistory.undo(); // edit undone on 100
      await undoHistory.redo(); // edit redone on 100
      await undoHistory.redo(); // delete redone on 100
      await undoHistory.undo(); // re-created again as 101
      expect(log).toEqual(['create', 'update 100 back', 'update 100 again', 'remove 100', 'create']);

      await undoHistory.undo();
      await undoHistory.redo();
      expect(log.slice(-2)).toEqual(['update 101 back', 'update 101 again']);
    });

    it('remaps Record actions waiting in the undone list when a Record is re-created', async () => {
      const { log, edit, deletion } = store();
      const undoHistory = new UndoHistory();
      undoHistory.record(edit(5));
      undoHistory.record(deletion(5));
      await undoHistory.undo(); // 100; both Record actions now point at 100
      await undoHistory.undo(); // edit sits in undone
      await undoHistory.redo();
      await undoHistory.redo(); // delete redone on 100
      await undoHistory.undo(); // 101: the edit is in done, the delete in undone
      await undoHistory.undo();
      expect(log.at(-1)).toBe('update 101 back');
      expect((await undoHistory.redo())?.recordId).toBe(101);
    });

    it('leaves Record actions for other Records untouched', async () => {
      const { log, edit, deletion } = store();
      const undoHistory = new UndoHistory();
      undoHistory.record(edit(7));
      undoHistory.record(edit(5));
      undoHistory.record(deletion(5));

      await undoHistory.undo();
      await undoHistory.undo();
      await undoHistory.undo();
      expect(log).toEqual(['create', 'update 100 back', 'update 7 back']);
    });
  });
});
