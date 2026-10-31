# tax Specification

## Requirements

### Requirement: VAT
The shop SHALL take a fifth of totals over 100 as tax.

#### Scenario: Large total
- **WHEN** the total is 200
- **THEN** the tax is 40

#### Scenario: Small total
- **WHEN** the total is 50
- **THEN** there is no tax
