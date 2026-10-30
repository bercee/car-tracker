# Undo re-creates deleted Records instead of restoring them

Undo and redo of Record actions live only in the frontend, in memory, with one Undo history per Car and Panel. Undoing a delete (or redoing an add) creates the Record again through the normal create endpoint, so it comes back with a new id and creation time. Ids inside the Undo history are remapped to the new id. Lists sort by event date and then id, so the re-created Record usually appears where it was before. We chose this over a backend restore so the API and database stay unchanged for a protection feature that only lasts one page load.

## Considered options

- Soft delete with a restore endpoint: keeps the original id, but needs a schema change and has to filter deleted rows from every query.
- Create with a client-supplied id: keeps the original id, but opens the create endpoint to id collisions and changes its contract.

## Consequences

- Undoing an edit puts back the earlier values with last-write-wins. There is no conflict detection, because the API has no version token.
- Nothing outside the frontend may rely on a Record's id staying the same across a delete and its undo.
