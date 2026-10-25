# Auth

## Purpose
Sessions and sign-in for the web client.

## Requirements

### Requirement: Session Timeout
The system SHALL end idle sessions.

#### Scenario: Idle timeout
- **THEN** the session ends

#### Scenario: Idle Timeout!
- **THEN** the session ends too

### Requirement: Session-Timeout
The system SHALL also end sessions.

#### Scenario: Any
- **THEN** ok

### Requirement: Sign In
The system SHALL sign users in.

#### Scenario: Valid password
- **THEN** the user is signed in
