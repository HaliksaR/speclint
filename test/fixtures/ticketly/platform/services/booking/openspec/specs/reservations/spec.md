# reservations Specification

## Purpose
TBD.

## Requirements

### Requirement: Hold seats
The system SHALL support hold seats.

#### Scenario: Seats held
- **WHEN** the client selects free seats
- **THEN** the seats are held for 10 minutes

#### Scenario: Hold expires
- **GIVEN** a hold older than 10 minutes
- **WHEN** the expiry job runs
- **THEN** the seats return to sale

### Requirement: Cancel reservation
The system SHALL support cancel reservation.

#### Scenario: Free cancellation
- **WHEN** the client cancels 24 hours before the event
- **THEN** the full price is refunded

### Requirement: Тайм-аут брони
The system SHALL support тайм-аут брони.

#### Scenario: Истечение
- **WHEN** срок брони истёк
- **THEN** бронь снимается

