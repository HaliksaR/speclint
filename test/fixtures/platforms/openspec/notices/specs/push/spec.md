# push Specification

## Purpose
Push notices about orders.

## Requirements

### Requirement: Push
The system SHALL send a push when the order status changes.

#### Scenario: Delivered
- **WHEN** the order status changes
- **THEN** the client gets a push

#### Scenario: Android: Quiet hours
- **WHEN** a push comes between 23:00 and 8:00
- **THEN** it is shown without sound
