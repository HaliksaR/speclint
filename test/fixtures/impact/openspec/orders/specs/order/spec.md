# order Specification

## Requirements

### Requirement: Checkout
The shop SHALL charge the total with tax and confirm paid orders.

#### Scenario: Total with tax
- **WHEN** the order costs 200
- **THEN** the total is 240

#### Scenario: Confirmed
- **WHEN** the order is paid
- **THEN** it is confirmed
