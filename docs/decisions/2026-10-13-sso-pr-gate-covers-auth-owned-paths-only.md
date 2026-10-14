# The SSO login matrix's PR trigger covers auth-owned paths only, not shared ui-core-components primitives

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer
- **Related:** open-metadata/openmetadata-collate#7358, #35338, #33575, #33646

## Context
`.github/workflows/playwright-sso-login-nightly.yml` also runs on `pull_request` for auth paths.
After #33575 / #33646 changed the DOM of core Button and Input and broke the Basic/LDAP login
locators, the trigger gained `openmetadata-ui-core-components` `base/buttons/**`, `base/input/**`,
`base/form/**` and `application/form-field/**`. Those primitives are touched by most UI PRs, so the
full 7-leg matrix (each leg boots the OM stack, ~15–22 min) ran on 614 PRs across 81 branches in 30
days, ~45k runner-minutes/month, almost all on PRs unrelated to auth.

## Decision
The `pull_request` paths cover only auth-owned code: Auth components/utils, the login/signup/password
pages and `LoginButton`, backend security and `ConfigResource`, auth schemas, and the SSO docker
fixtures. Shared ui-core-components primitives are deliberately excluded.

## Consequences
Login-locator drift caused by a core primitive change is caught by the nightly schedule (or a manual
`workflow_dispatch`) within 24h instead of on the originating PR, so the nightly must be triaged.
Revisit if such drift repeatedly lands on `main` or if the matrix becomes cheap enough to run per PR.
