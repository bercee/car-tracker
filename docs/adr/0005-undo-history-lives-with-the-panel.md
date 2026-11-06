# The Undo history lives with the Panel

The Undo history belongs to one Panel instance. Panels remount when the Active car changes, so switching Cars drops the history. Switching Sections keeps it, because visited Panels stay mounted but hidden. A page reload drops it as well. We chose this so the Panel owns its Record actions, its messages and its in-flight handling in one place, instead of sharing them with a store above it.

## Considered options

- History owned by `App`, keyed by Car and Panel, surviving Car switches: rejected because the Panel's records, messages and in-flight handling live in the Panel while the history lives above it, so a change can outlive the Panel that started it. That needs a shared pending flag, an external-store subscription and a reload-on-foreign-change hook, a lot of machinery for a rare scenario.
- A React Router route per Panel: does not help, since a history that survives navigation still has to live above the routes, and routes would unmount Sections that now stay mounted.
- A per-Car, per-Panel store holding Records and pending state above the Panel: coherent but larger, and only worth it if surviving Car switches matters.

## Consequences

- Undoing something done before a Car switch is not possible.
- An undo in flight during a Car switch still reaches the server, but its result is ignored by the unmounted Panel and the history is gone.
