# The server applies the SSO profile on server-driven logins

- **Status:** Accepted
- **Revisions:** v1 2026-10-17 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserProfileClaimsTest`, `AuthenticationCodeFlowHandlerTest`, `EmailFirstIdentityIT.testSignInStoresAndRefreshesTheProviderPicture`, `AuthProvider.test.tsx` ("leaves the profile to the server after a confidential-client login")
- **Related:** #35674, #25623, #25391

## Context

A user's display name and picture come from the identity provider's ID token claims (`name`, or
`given_name` + `family_name`, and `picture`). Under a public OIDC client the browser holds those
claims and writes them to the user with a PATCH. Under a confidential client, and under SAML, the
server completes sign-in. The browser is only handed the OpenMetadata username in a redirect
parameter.

So nobody applied the provider's profile on those logins. The legacy principal-claims path
resolved the display name and dropped it (from 1.12.4), and no server path read `picture`. The
browser then saved the username it was handed as the display name.

## Decision

- **Who writes it.** When the server completes sign-in (a confidential OIDC client, or SAML), the
  server applies the provider's display name and picture. The UI does not write the profile after
  such a login (`isServerDrivenLogin`). Under a public OIDC client the browser keeps doing it.
- **Picture.** The server reads the standard OIDC `picture` claim and stores it only if it is an
  absolute `http`/`https` URI, because it becomes an image source in the browser. A new picture
  replaces the whole stored image list, so sizes derived from an older picture stop showing. A
  token without a picture leaves the stored one alone.
- **Display name on the legacy principal-claims path.** The provider's name fills the display name
  only when the account has none, or has one equal to its login name, which is what the browser
  wrote while the provider's name was dropped. Any other display name was chosen in OpenMetadata
  and is kept. The email-first path keeps its existing rule: the provider's name replaces the
  stored one whenever the provider sends one.

## Consequences

- Accounts that the browser stamped with their login name are repaired on their next sign-in,
  without a migration.
- Profile pictures depend on the provider sending `picture` for the requested scopes. Azure AD
  sends none, so its users still have no picture.
- Moving the display-name rule of the two paths into line, either way, means revisiting this
  record: the legacy path would overwrite chosen names, or the email-first path would stop
  following provider renames.
