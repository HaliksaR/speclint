# Add 2FA

## Why
Passwords alone are weak; see spec:auth/sign-in and spec:identity/user-auth/user-record.

## What Changes
- Adds spec:auth/two-factor#code-required on top of spec:auth/session-timeout#idle-timeout.
