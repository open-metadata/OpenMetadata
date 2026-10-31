# A provider token must carry an email while sign-in email domains are restricted

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtFilterTest` (`aProviderTokenWithoutAnEmailIsRefusedWhileEmailDomainsAreRestricted`,
  `anEmailInALaterPrincipalClaimIsTheOneChecked`, `aProviderTokenWithoutAnEmailSignsInWhenNoDomainsAreRestricted`)
- **Related:** open-metadata/openmetadata-collate#7797

## Context
The legacy claim flow names the account after the first principal claim present in a provider
token. When `allowedEmailDomains` was set and that claim held no `@`, the filter checked the address
it would build, `userName@principalDomain`. `principalDomain` falls back to the allowed domains, so
that address passes by construction: a provider that issues tokens without an email — for example
one whose client the caller can drive with a narrower scope — let anyone sign in past the allowlist.
The filter also read only the first principal claim, so an email in a later claim was never checked.

## Decision
- While `allowedEmailDomains` is set, a provider token in the legacy flow must assert an email: the
  mapped email claim when `jwtPrincipalClaimsMapping` is set, otherwise the first principal claim
  that holds an `@`, whichever claim names the account. That email must be in an allowed domain.
- A provider token with no such email is refused with 401.
- OpenMetadata-issued tokens and bot tokens are unaffected; they never reach this check.
- Without an allowlist nothing changes: a bare principal claim still signs in.

## Consequences
A deployment that sets `allowedEmailDomains` must have its provider put the email in a principal
claim (or map it). One whose tokens carry no email anywhere was not restricted by the allowlist
before; it is now refused at sign-in until the claim is added or the allowlist removed.
