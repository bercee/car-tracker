# Car Tracker

A personal tool for logging what a person's cars consume and cost: fuel, AdBlue and other expenses. It has one user, who may own several cars.

## Language

**Car**:
A distinct tracked automobile to which Records belong. A person may track several Cars.
_Avoid_: Vehicle

**Record**:
One logged event for a Car: a fuel fill-up, an AdBlue top-up, or an expense. Each Record belongs to exactly one Car.
_Avoid_: Entry, log
