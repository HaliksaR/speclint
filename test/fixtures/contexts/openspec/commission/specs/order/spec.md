# order Specification

## Requirements

### Requirement: Accept
The site SHALL accept an order.

#### Scenario: Accepted
- **WHEN** the customer sends a request
- **THEN** the order is accepted

#### Scenario: Rejected
- **WHEN** the request has no consent
- **THEN** the order is rejected

Shown in spec:showcase:feed/show and needs spec:platform:access/sign-in.
