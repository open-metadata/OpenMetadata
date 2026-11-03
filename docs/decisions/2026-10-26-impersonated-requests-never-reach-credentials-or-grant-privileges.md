# Impersonated requests never reach a credential endpoint or grant a privilege

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial) · v2 2026-10-29 (user creation and restore, and
  security configuration writes)
- **Deciders:** Adrià Manero
- **Guard:** `ImpersonationRestrictionFilterTest` (pins the `@IdentityEndpoint` methods of
  `UserResource`, `SystemResource` and `ScimResource`); `BotImpersonationIT`; reviewer for new
  endpoints
- **Related:** PR #36231; PR #36591; ADR:2026-10-21-only-admins-change-a-users-domains

## Context

A bot with impersonation enabled sends `X-Impersonate-User` and acts as that user for one request.
Anything that request mints or grants outlives it: a JWT, a personal access token, a password, a new
bot and its token, or an admin flag or role on an account the bot controls. One impersonated request
would then become lasting access.

`ImpersonationRestrictionFilter` used to compare the request path with a list of strings. Jersey
routes on a normalised path (it drops `;matrix` parameters and accepts a trailing slash), so some
spellings of a blocked URL reached the handler without matching the list.

## Decision

- **A method that creates, reveals, rotates or revokes a credential or session carries
  `@IdentityEndpoint`.** It is a JAX-RS name binding: Jersey runs `ImpersonationRestrictionFilter`
  only for annotated methods, after routing, and the filter refuses any impersonated request. No
  security decision is made on the URL text.
- **This covers `/v1/bots` writes**, because creating or changing a bot hands out a credential.
- **A user change that grants privileges is refused while impersonating, through every verb.**
  `UserResource.authorizeAdminForPrivilegedFields` rejects impersonated callers, and POST, PUT and
  PATCH all go through it for `isAdmin`, `isBot`, roles, domains and closed teams. It reads the
  impersonation from `ContainerRequestContext`, because the injected `SecurityContext` is a Jersey
  proxy that hides it.
- **Other repositories opt in the same way.** Collate annotates its own credential endpoints with
  `@IdentityEndpoint`; the server does not list them.

## Consequences

- A new credential endpoint is safe only once it carries the annotation. Forgetting it is a review
  finding, and removing it from a `UserResource` method fails `ImpersonationRestrictionFilterTest`.
- A bot impersonating a user can still read and edit metadata as that user, which is what
  impersonation is for. It cannot keep that access after the request.
- Revisit this if impersonation ever needs to manage credentials on a user's behalf; that would
  need its own, narrower grant.

## Amendment: user creation and restore, and security configuration writes (v2)

- **An impersonated request does not create or restore a user, through any endpoint.**
  `POST /v1/users`, `PUT /v1/users/import`, `PUT /v1/users/importAsync`, `PUT /v1/users/restore`
  and `POST /v1/scim/Users` carry `@IdentityEndpoint`, and `PUT /v1/users` refuses an impersonated
  request when the user does not exist or is soft-deleted. Updating an active user is not
  affected.
- **Writing the security configuration is an identity endpoint.** `PUT` and
  `PATCH /v1/system/security/config` and `POST /v1/system/settings/source/{configType}/adopt`
  carry `@IdentityEndpoint`. Reading and validating it are not affected.
- `ImpersonationRestrictionFilterTest` pins the annotated methods of `SystemResource` and
  `ScimResource` as it does for `UserResource`.
