// One Undo history: the Record actions of a single Car in a single Panel.
// Framework-independent; entries carry their own effects so the module never touches the API.
//
// An effect receives the id the Record has right now. An effect that creates the Record
// again resolves to its new id (ADR 0003); the history then points every entry that referred
// to the old id, done or undone, at the new one.
export interface UndoEntry {
  recordId: number;
  description: string;
  reverse: (recordId: number) => Promise<void | number>;
  reapply: (recordId: number) => Promise<void | number>;
}

export class UndoHistory {
  private done: UndoEntry[] = [];
  private undone: UndoEntry[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  /** True while a change to this history's Records is in flight; undo and redo do nothing meanwhile. */
  pending = false;

  // Arrow functions, so React's useSyncExternalStore can take them unbound.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Changes whenever anything the history reports changes. */
  snapshot = () => this.version;

  record(entry: UndoEntry) {
    this.done.push(entry);
    this.undone.length = 0;
    this.notify();
  }

  undoDescription() {
    return this.done.at(-1)?.description;
  }

  redoDescription() {
    return this.undone.at(-1)?.description;
  }

  /** Runs a change with the history marked pending, so no undo or redo races it, even across Panel remounts. */
  async run<T>(change: () => Promise<T>) {
    this.setPending(true);
    try {
      return await change();
    } finally {
      this.setPending(false);
    }
  }

  // Resolves to the entry that was applied, or undefined when there is nothing to do or a change is pending.
  // A failing effect rejects. The entry stays where it was (so the user can retry) unless
  // `shouldDiscard` says the failure is final, in which case only that entry is dropped.
  undo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.done, this.undone, 'reverse', shouldDiscard);
  }

  redo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.undone, this.done, 'reapply', shouldDiscard);
  }

  // Applies the newest entry of `from` and moves it onto `to`.
  private async step(
    from: UndoEntry[],
    to: UndoEntry[],
    effect: 'reverse' | 'reapply',
    shouldDiscard: (cause: unknown) => boolean,
  ) {
    const entry = from.at(-1);
    if (!entry || this.pending) return undefined;
    await this.run(async () => {
      try {
        this.remap(entry.recordId, await entry[effect](entry.recordId));
      } catch (cause) {
        if (shouldDiscard(cause)) from.pop();
        throw cause;
      }
      from.pop();
      to.push(entry);
    });
    return entry;
  }

  private setPending(pending: boolean) {
    this.pending = pending;
    this.notify();
  }

  private notify() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  private remap(oldId: number, created: void | number) {
    if (created === undefined || created === oldId) return;
    for (const entry of [...this.done, ...this.undone]) {
      if (entry.recordId === oldId) entry.recordId = created;
    }
  }
}
