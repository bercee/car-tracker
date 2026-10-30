# Plain units end to end, Zod schemas as the contract

Quantities travel and are stored in their natural units with as little conversion as possible. Liters and HUF amounts are JSON numbers on the wire, not decimal strings. Postgres stores liters as `numeric(7,3)`, read as a JS number, and HUF as `integer`. Request validation is defined once as Zod schemas in `contracts`, which the backend and frontend share, and the request types are inferred from them.

The earlier design used canonical decimal strings on the wire and milliliter integers in storage. It was a workaround for SQLite's weak decimal support and for fear of JS float rounding, and it cost a hand-written decimal parser, BigInt arithmetic, formatters, and a second, drifting copy of the rules in the frontend. At these magnitudes (at most 9,999.999 L and 9,999,999 HUF) a JS double holds every valid value exactly, and `numeric(7,3)` keeps storage and any future aggregation exact.

## Consequences

- Schemas in `contracts` check only the wire shape. They hold no storage detail.
- Field and column names match across wire and storage (`liters`, `price`), so mappers barely convert. What a Record cost is always `price`, including on expenses, which previously used `amount`.
- Validation errors keep the single `{ code, message, field }` envelope, filled from Zod's first issue.
- The baseline migration was regenerated rather than migrated forward, because no database held data worth keeping at the time.
