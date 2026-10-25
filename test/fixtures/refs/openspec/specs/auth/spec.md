# Auth

## Purpose
Sessions and sign-in for the web client.

## Requirements

### Requirement: Session Timeout
The system SHALL end idle sessions.

#### Scenario: Idle timeout
- **WHEN** the user is idle for 30 minutes
- **THEN** the session ends

### Requirement: Log In
The system SHALL sign users in with a password.

#### Scenario: Valid password
- **THEN** the user is signed in
