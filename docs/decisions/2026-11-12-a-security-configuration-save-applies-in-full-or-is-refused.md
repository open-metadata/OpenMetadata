# A security configuration save applies in full or is refused with its reason

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SsoSecurityConfigApplyIT` (CF-02, CF-03, LD-12), `SsoSamlLoginIT` (SA-11),
  `SsoOidcConfidentialLoginIT` (OC-15), `SystemRepositorySecurityConfigPatchTest`
- **Related:** 2.1.0 release testing, SSO row

## Context
`PUT` and `PATCH /v1/system/security/config` stored the configuration before the server tried to
apply it. When applying failed (an LDAP directory refusing the bind, a keystore that cannot be
read, LDAPS without a trust store) the server kept running the previous configuration but the new
one stayed in the database, to be loaded at the next start or by another server, and the request
answered 500 or 401. A confidential OIDC client whose authentication method the server cannot use
was saved and silently disabled sign-in. A `PATCH` that switched provider had the new provider's
settings dropped, because operations were filtered by the stored provider, and a `PATCH` whose
every change was dropped answered 204.

## Decision
- When the server cannot apply a saved configuration, it stores the previous one again and
  answers 400 with the reason. The configuration that was running keeps running.
- A `PUT`, which skips the full validation a `PATCH` and `/security/validate` run, still makes the
  checks that need no network: the client authentication method of a confidential OIDC client must
  be one the server performs (`client_secret_basic`, `client_secret_post`), and SAML request or
  metadata signing needs the SP certificate and key. Full validation also checks the method
  against the provider's discovery document.
- A `PATCH` is filtered by the provider it leaves in place, so it can switch provider. A `PATCH`
  that asks to set values the provider does not use, with nothing else to apply, is refused with
  400. Removing another provider's block still changes nothing and is not an error.
- An unreachable identity provider at save time is not decided here.

## Consequences
What a save reports is what every server runs. A failed apply costs a second write. Adding a
provider block or a provider-specific setting means extending the `PATCH` filter.
