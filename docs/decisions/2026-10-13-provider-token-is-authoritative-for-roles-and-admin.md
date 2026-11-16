# With useRolesFromProvider on, the provider's token is authoritative for roles and admin

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserUtilTest` (`reSyncUserRolesFromToken*`); `JwtFilterTest`
  (`providerTokenWithoutARolesClaimGrantsNoRoles`, `openMetadataIssuedTokenRolesNeverReachTheRoleSync`);
  `AuthenticationCodeFlowHandlerTest` (`syncRolesFromProvider_*`); `ProviderRoleSyncIT`
- **Related:** open-metadata/openmetadata-collate#7359, #32960

## Context
`useRolesFromProvider` syncs a user's roles from the token's `roles` claim at the OIDC callback and
on `/users/loggedInUser`. Since #32960 a token without a `roles` claim was read as "the provider
said nothing" and left the user alone, and Admin could only be granted, never removed, so that
`adminPrincipals` admins could not be locked out.

Entra ID sends no `roles` claim at all once a user's last app role is unassigned. OIDC Core 5.1 has
providers omit claims that have no value. So removing every app role in Entra changed nothing here,
and removing the Admin app role never demoted anyone. The sync also read the `roles` claim of tokens
OpenMetadata mints itself (session tokens, PATs). Those carry the roles the user had when they were
minted, so a tab left open, or a PAT, restored roles the provider had revoked.

## Decision
- Only a token the identity provider issued is synced from. A token OpenMetadata issued
  (`JwtFilter.isInternallyIssuedToken`) has nothing to sync, so it never changes a user's roles.
- In a provider token, an absent `roles` claim means no roles. The provider's roles replace the
  user's roles; a provider token never leaves them alone.
- Admin follows the provider's `Admin` role in both directions, except for users named in
  `adminEmails` or `adminPrincipals` (`UserUtil.isConfiguredAdmin`), who stay admins whatever the
  token says.
- Bots are never synced.

## Consequences
Turning the setting on hands roles and admin to the identity provider. If the provider sends no
`roles` claim, every user's roles are removed at their next sign-in, and admins other than
configured ones are demoted. Roles and admin granted by hand in OpenMetadata, and
`defaultOAuthRole`, do not survive a sign-in either.

The sync runs at sign-in (and, for public clients, on `/users/loggedInUser`), so a revocation in the
provider takes effect at the user's next sign-in, not mid-session. Immediate deprovisioning still
needs SCIM or the users API.

Revisit this if the roles claim name becomes configurable: an absent claim could then also mean
"not configured", which this record treats as "no roles".
