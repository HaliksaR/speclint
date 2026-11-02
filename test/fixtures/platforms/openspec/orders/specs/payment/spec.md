# payment Specification

## Purpose
Payment of an order.

## Requirements

### Requirement: Pay order
The system SHALL take payment for an order.

#### Scenario: Card payment
- **WHEN** the client pays by card
- **THEN** the order is paid

#### Scenario: iOS: Apple Pay
- **WHEN** the client pays with Apple Pay
- **THEN** the order is paid by Apple Pay

#### Scenario: Web, Android: Saved card
- **WHEN** the client picks a saved card
- **THEN** the card form is skipped

### Requirement: Widget
The system SHALL show the order on a home screen widget.

#### Scenario: iOS: Widget shows status
- **WHEN** the order status changes
- **THEN** the widget shows the new status
