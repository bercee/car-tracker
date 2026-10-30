# Car Tracker

A personal tool for logging what a person's cars consume and cost: fuel, AdBlue and other expenses. It has one user, who may own several cars. All money is in whole Hungarian forints (HUF); volumes are in liters.

## Language

**Car**:
A distinct tracked automobile to which Records belong. A person may track several Cars.
_Avoid_: Vehicle

**Record**:
One logged event for a Car: a fuel fill-up, an AdBlue top-up, or an expense. Each Record belongs to exactly one Car.
_Avoid_: Entry, log

**Price**:
What a Record cost, in whole HUF. Every Record type, an expense included, has a Price.
_Avoid_: Amount, cost
