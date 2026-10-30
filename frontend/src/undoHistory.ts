// One Undo history: the Record actions of a single Car in a single Panel.
// Framework-independent; entries carry their own effects so the module never touches the API.
export interface UndoEntry {
  recordId: number;
  description: string;
  reverse: () => Promise<void>;
  reapply: () => Promise<void>;
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
    await entry.reverse();
    this.done.pop();
    this.undone.push(entry);
    return entry;
  }

  async redo() {
    const entry = this.undone.at(-1);
    if (!entry) return undefined;
    await entry.reapply();
    this.undone.pop();
    this.done.push(entry);
    return entry;
  }
}
