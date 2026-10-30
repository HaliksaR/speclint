# price Specification

## Requirements

### Requirement: Bulk price
The shop SHALL double the price of large orders.

#### Scenario: Large order
- **WHEN** the order has more than 10 items
- **THEN** the price is doubled

#### Scenario: Small order
- **WHEN** the order has 10 items or fewer
- **THEN** the price is not doubled

### Requirement: Discount
The shop SHALL give 10 off orders of 100 or more.

#### Scenario: Discount applied
- **WHEN** the order costs 100 or more
- **THEN** 10 is taken off
