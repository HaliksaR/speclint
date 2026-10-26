# Auth

## Purpose
Sessions and sign-in.

## Requirements

### Requirement: Sign In
The system SHALL sign users in with a password.

#### Scenario: Valid password
- **WHEN** the user enters a valid password
- **THEN** the user is signed in

#### Scenario: Wrong password
- **WHEN** the user enters a wrong password
- **THEN** sign-in is refused

### Requirement: Session Timeout
The system SHALL end sessions.

#### Scenario: Idle timeout
- **WHEN** the user is idle for 30 minutes
- **THEN** the session ends

#### Scenario: Absolute timeout
- **WHEN** the session is 12 hours old
- **THEN** the session ends

### Requirement: Logout
The system SHALL sign users out.

#### Scenario: Manual logout
- **WHEN** the user presses Log out
- **THEN** the session ends
