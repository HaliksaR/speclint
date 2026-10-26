## ADDED Requirements

### Requirement: Waitlist
The system SHALL support waitlist.

#### Scenario: Join waitlist
- **WHEN** the event is sold out
- **THEN** the client may join the waitlist

## MODIFIED Requirements

### Requirement: Cancel reservation
The system SHALL support cancel reservation.

#### Scenario: Free cancellation
- **WHEN** the client cancels 24 hours before the event
- **THEN** the full price is refunded

#### Scenario: Waitlist promotion
- **WHEN** a reservation is cancelled
- **THEN** the first waitlisted client is offered the seats

