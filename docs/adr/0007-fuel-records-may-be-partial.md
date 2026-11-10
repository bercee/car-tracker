# Fuel Records may be partial

A Fuel Record needs at least one of a date, an odometer reading or liters. Everything else, Price included, may be blank and is stored as NULL, never as zero. The rule is enforced three times: a refinement on the shared Zod request schema (message "Enter at least a date, odometer or liters."), the Panel form, and a CHECK constraint in Postgres, so no client or script can bypass it. AdBlue and Expenses Records keep requiring all their fields.

We need this because a Car's history can arrive with no dates, and a fill-up is sometimes only partly known. The alternative was to make the user invent values or drop what they do know. Those three fields are the ones that can place or size a fill-up. A Record with only a Price or only a Reported consumption cannot be placed in the Car's history or used for any consumption figure, so it is rejected.

A Fuel Record can also hold a Reported consumption, the L/100 km the car computer showed. It is stored as `numeric(4,1)`, read as a JS number, with a CHECK that it is above zero. Its largest value is 99.9, so a JS double holds it exactly, as ADR 0004 argues for liters and Price.

## Considered options

- A tri-state full tank (yes, no, unknown): `full_tank` stays a required boolean defaulting to true, so an unchecked box means "not a full tank" and there is no third state to handle. Analysis can decide later how to treat unknowns.
- A separate table for historical Records: one fuel table is enough, because a historical Record is just a partial one.

## Consequences

- The baseline migration and its snapshot were regenerated again, with no forward migration, following ADR 0004. Production holds no data worth keeping.
- Fuel listings sort by event date, then odometer, then id, all descending with NULLs last. This refines ADR 0003, which said lists sort by event date and then id: undated Fuel Records now sort by odometer before id. A Record re-created by undo still lands in its old place, because the order does not depend on the id unless date and odometer are both equal or blank.
- API responses always include every field, with explicit `null` for absent values. Requests accept either `null` or an omitted field.
- Consumption analysis must decide which partial Records it includes. This ADR does not.
