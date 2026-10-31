// One Undo history: the Record actions of a single Car in a single Panel.
// Framework-independent; Record actions carry their own effects so the module never touches the API.
//
// An effect receives the id the Record has right now. An effect that creates the Record
// again resolves to its new id (ADR 0003); the history then points every Record action that
// referred to the old id, done or undone, at the new one.
export interface RecordAction {
  recordId: number;
  /** What the action did, for example "edit of Fuel record". */
  label: string;
  /** The event date of the Record the action acted on. */
  eventDate: string;
  reverse: (recordId: number) => Promise<void | number>;
  reapply: (recordId: number) => Promise<void | number>;
}

export class UndoHistory {
  private done: RecordAction[] = [];
  private undone: RecordAction[] = [];
  private listeners = new Set<() => void>();
  private version = 0;
  private inFlight = false;

  // Arrow functions, so React's useSyncExternalStore can take them unbound.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Changes whenever anything the history reports changes. */
  snapshot = () => this.version;

  /** True while a change to this history's Records is in flight; undo and redo do nothing meanwhile. */
  get pending() {
    return this.inFlight;
  }

  record(action: RecordAction) {
    this.done.push(action);
    this.undone.length = 0;
    this.notify();
  }

  nextUndo(): RecordAction | undefined {
    return this.done.at(-1);
  }

  nextRedo(): RecordAction | undefined {
    return this.undone.at(-1);
  }

  /** Runs a change with the history marked pending, so no undo or redo races it, even across Panel remounts. */
  async run<T>(change: () => Promise<T>) {
    this.setInFlight(true);
    try {
      return await change();
    } finally {
      this.setInFlight(false);
    }
  }

  // Resolves to the Record action that was applied, or undefined when there is nothing to do or a
  // change is pending. A failing effect rejects. The Record action stays where it was (so the user
  // can retry) unless `shouldDiscard` says the failure is final, in which case only it is dropped.
  undo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.done, this.undone, 'reverse', shouldDiscard);
  }

  redo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.undone, this.done, 'reapply', shouldDiscard);
  }

  // Applies the newest Record action of `from` and moves it onto `to`.
  private async step(
    from: RecordAction[],
    to: RecordAction[],
    effect: 'reverse' | 'reapply',
    shouldDiscard: (cause: unknown) => boolean,
  ) {
    const action = from.at(-1);
    if (!action || this.inFlight) return undefined;
    await this.run(async () => {
      try {
        this.remap(action.recordId, await action[effect](action.recordId));
      } catch (cause) {
        if (shouldDiscard(cause)) from.pop();
        throw cause;
      }
      from.pop();
      to.push(action);
    });
    return action;
  }

  private setInFlight(inFlight: boolean) {
    this.inFlight = inFlight;
    this.notify();
  }

  private notify() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  private remap(oldId: number, created: void | number) {
    if (created === undefined || created === oldId) return;
    for (const action of [...this.done, ...this.undone]) {
      if (action.recordId === oldId) action.recordId = created;
    }
  }
}
