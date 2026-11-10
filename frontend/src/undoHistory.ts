// One Undo history: the Record actions of a single Panel for the Active car.
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
  eventDate: string | null | undefined;
  reverse: (recordId: number) => Promise<void | number>;
  reapply: (recordId: number) => Promise<void | number>;
}

export class UndoHistory {
  private done: RecordAction[] = [];
  private undone: RecordAction[] = [];
  private stepping = false;

  record(action: RecordAction) {
    this.done.push(action);
    this.undone.length = 0;
  }

  nextUndo(): RecordAction | undefined {
    return this.done.at(-1);
  }

  nextRedo(): RecordAction | undefined {
    return this.undone.at(-1);
  }

  // Resolves to the Record action that was applied, or undefined when there is nothing to do or an
  // undo or redo is already running. A failing effect rejects. The Record action stays where it was
  // (so the user can retry) unless `shouldDiscard` says the failure is final, in which case only it is dropped.
  undo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.done, this.undone, 'reverse', shouldDiscard);
  }

  redo(shouldDiscard: (cause: unknown) => boolean = () => false) {
    return this.step(this.undone, this.done, 'reapply', shouldDiscard);
  }

  private async step(
    from: RecordAction[],
    to: RecordAction[],
    effect: 'reverse' | 'reapply',
    shouldDiscard: (cause: unknown) => boolean,
  ) {
    const action = from.at(-1);
    if (!action || this.stepping) return undefined;
    this.stepping = true;
    try {
      try {
        this.remap(action.recordId, await action[effect](action.recordId));
      } catch (cause) {
        if (shouldDiscard(cause)) from.pop();
        throw cause;
      }
      from.pop();
      to.push(action);
    } finally {
      this.stepping = false;
    }
    return action;
  }

  private remap(oldId: number, created: void | number) {
    if (created === undefined || created === oldId) return;
    for (const action of [...this.done, ...this.undone]) {
      if (action.recordId === oldId) action.recordId = created;
    }
  }
}
