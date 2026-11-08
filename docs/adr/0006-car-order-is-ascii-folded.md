# Car order folds only ASCII case

Cars are listed by name ignoring ASCII case, then by ID. The backend sorts with `lower(name COLLATE "C")` and the frontend repeats the same comparison when it re-sorts after adding or renaming a Car. Case folding covers only A-Z and comparison is by code point, so the order does not depend on the database locale or the browser locale. The unique-name index uses the same folding, so uniqueness and ordering agree.

## Considered options

- Locale-aware collation or `localeCompare`: rejected because the backend and the frontend would disagree whenever their locales differ, and the list would visibly jump after a reload.
- Re-fetching the Car list after every add or rename instead of re-sorting locally: avoids the duplicated rule, but costs a request and a loading state for a trivial change.

## Consequences

- Names with non-ASCII letters sort by code point and `Å` and `å` are distinct names.
- The backend ordering and `byName` in `frontend/src/App.tsx` must change together.
