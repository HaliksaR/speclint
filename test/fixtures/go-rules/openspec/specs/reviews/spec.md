# reviews Specification

## Requirements

### Requirement: Send review
The site SHALL take a review.

#### Scenario: Pending
- **WHEN** the customer sends a review
- **THEN** the review is pending

#### Scenario: Reason 1–200 chars
- **WHEN** the reason is empty
- **THEN** the server answers 400

#### Scenario: Untested
- **WHEN** nothing marks it
- **THEN** it stays untested
