# drawer Specification

## Requirements

### Requirement: Close guard
The drawer SHALL warn before closing with changes.

#### Scenario: Server page
- **WHEN** the customer opens the page
- **THEN** the drawer has stay and leave buttons

#### Scenario: Script guard
- **WHEN** the customer closes a changed form
- **THEN** the drawer stays open

#### Scenario: Both
- **WHEN** the customer closes a pristine form
- **THEN** the drawer closes

#### Scenario: Mixed
- **WHEN** the customer opens the board
- **THEN** the board and its script agree
