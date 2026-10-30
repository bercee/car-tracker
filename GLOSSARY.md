# Car Tracker

A personal tool for logging what a person's cars consume and cost: fuel, AdBlue and other expenses. It has one user, who may own several cars. All money is in whole Hungarian forints (HUF); volumes are in liters.

## Language

### Cars and Records

**Car**:
A distinct tracked automobile to which Records belong. A person may track several Cars.
_Avoid_: Vehicle

**Active car**:
The Car whose Records the Panels currently show.
_Avoid_: Current car, selected car

**Record**:
One logged event for a Car: a fuel fill-up, an AdBlue top-up, or an expense. Each Record belongs to exactly one Car.
_Avoid_: Entry, log

**Record type**:
The kind of a Record: Fuel, AdBlue or Expenses.
_Avoid_: Category

**Price**:
What a Record cost, in whole HUF. Every Record type, an expense included, has a Price.
_Avoid_: Amount, cost

### Screen

**Section**:
One of the switchable areas of the screen: a Panel for each Record type, plus Cars.
_Avoid_: Tab, page

**Panel**:
The Section that shows and edits the Records of one Record type for the Active car.
_Avoid_: Tab, view

### Undo and redo

**Record action**:
A single add, edit or delete of a Record made by the user; the unit that can be undone and redone.
_Avoid_: Command, operation, change

**Undo history**:
The ordered Record actions of one Car in one Panel, kept only until the page reloads.
_Avoid_: Undo stack, history
