# A user created through the API or the CSV import must pass the sign-in email-domain rule

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserUtilTest` (`emailDomainRejection*`, `validateEmailDomainThrowsBadRequestWithTheReason`);
  `SystemResourceIT` (`test_allowedEmailDomains_*`, `test_deprecatedEnforcePrincipalDomain_*`)
- **Related:** #19306, #35613

## Context
Login refuses a user whose email domain is outside the configured sign-in domains:
`allowedEmailDomains`, or the deprecated `enforcePrincipalDomain` with `allowedDomains` and
`principalDomain` (`SecurityUtil.validateConfiguredEmailDomain`). Nothing applied that rule when a
user was created. An admin could create a user, through `POST`/`PUT /v1/users` or the user CSV
import, whose owner could then never sign in through the identity provider.

Login does not apply the rule to every user. It skips OpenMetadata-issued tokens. Those cover the
sessions of the native-password providers (`basic`, `openmetadata`), bots, and users that
server-side code creates and signs in itself, such as the bootstrap admins and support access. A
creation check stricter than login would refuse users who can log in.

## Decision
- The user-facing create paths check a new user's email against the sign-in rule and reject it
  with a 400. They are `POST /v1/users`, `PUT /v1/users` when it creates the user, and the user CSV
  import for rows that create a user, dry runs included. The rule is the login rule, shared through
  `SecurityUtil.configuredEmailDomains`.
- The check is skipped where login skips it: for bots, and for every user under a native-password
  provider (`SecurityConfigurationManager.isNativePasswordProvider`).
- Code that creates users server-side through `UserRepository` is not checked. Neither is SSO first
  login here, because the SAML, OIDC and LDAP sign-in paths apply the rule before they provision a
  user.
- Updates are not checked: `UserRepository.UserUpdater` keeps the stored email on every update.
- The rejection is a plain 400 whose message names the rejected domain and the allowed ones. There
  is no machine-readable error type, because `CatalogGenericExceptionMapper` returns only `code`
  and `message`.

## Consequences
A new user-facing create path must call `UserUtil.validateEmailDomain`, or
`UserUtil.emailDomainRejection` for a row-based import. Nothing applies the rule for it. Server-side
callers that create users who sign in with OpenMetadata-issued tokens need no exemption.

Under a native-password provider, `allowedEmailDomains` and `enforcePrincipalDomain` restrict
neither login nor creation. `allowedEmailRegistrationDomains` governs self-signup there. Revisit
this if login starts applying the domain rule to OpenMetadata-issued tokens, because creation
should then follow.
