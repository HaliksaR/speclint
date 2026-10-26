# Auth

## Purpose
Sign-in, logout and export.

## Requirements

### Requirement: Sign In
The system SHALL sign users in with a password.

#### Scenario: Valid password
- **WHEN** the user enters a valid password
- **THEN** the user is signed in

#### Scenario: Wrong password
- **WHEN** the user enters a "wrong" password
- **THEN** sign-in is refused

### Requirement: Logout
The system SHALL sign users out.

#### Scenario: Manual logout
- **GIVEN** a signed-in user
- **WHEN** the user presses Log out
- **THEN** the session ends

### Requirement: Export
The system SHALL export data.

#### Scenario: CSV
The export is a plain file.
- **WHEN** the user exports to CSV
- **THEN** a file is downloaded
- AND it has a header
