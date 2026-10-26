# Auth

## Purpose
Sessions and sign-in.

## Requirements

### Requirement: Session Timeout
The system SHALL end sessions.

#### Scenario: Idle timeout
- **WHEN** the user is idle for 30 minutes
- **THEN** the session ends

#### Scenario: Absolute timeout
- **WHEN** 12 hours pass
- **THEN** the session ends

#### Scenario: Remember me
- **WHEN** the user chose remember me
- **THEN** the session lasts 30 days

### Requirement: Log In
The system SHALL sign users in.

#### Scenario: Valid password
- **WHEN** the password is valid
- **THEN** the user is signed in
