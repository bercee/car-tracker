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

  record(entry: UndoEntry) {
    this.done.push(entry);
    this.undone = [];
  }

  undoDescription() {
    return this.done.at(-1)?.description;
  }

  redoDescription() {
    return this.undone.at(-1)?.description;
  }

  // Resolves to the entry that was applied, or undefined when there is nothing to do.
  // A failing effect rejects and leaves the entry where it was.
  async undo() {
    const entry = this.done.at(-1);
    if (!entry) return undefined;
    this.remap(entry.recordId, await entry.reverse(entry.recordId));
    this.done.pop();
    this.undone.push(entry);
    return entry;
  }

  async redo() {
    const entry = this.undone.at(-1);
    if (!entry) return undefined;
    this.remap(entry.recordId, await entry.reapply(entry.recordId));
    this.undone.pop();
    this.done.push(entry);
    return entry;
  }

  private remap(oldId: number, created: void | number) {
    if (created === undefined || created === oldId) return;
    for (const entry of [...this.done, ...this.undone]) {
      if (entry.recordId === oldId) entry.recordId = created;
    }
  }
}
