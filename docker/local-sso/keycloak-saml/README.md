# Keycloak SSO Fixture

Local IdP fixture for the Playwright SSO specs. The realm serves **both** a SAML
client and a confidential **OIDC** client — Keycloak hosts the two protocols side
by side, so one container covers both legs.

```bash
docker compose -f docker/local-sso/keycloak-saml/docker-compose.yml up -d
```

It imports one realm for an OpenMetadata server running at `http://localhost:8585`:

- `om-azure-saml`
  - User: `azure.saml@openmetadata.local`
  - Password: `OpenMetadata@123`
  - SAML client: `http://localhost:8585/api/v1/saml/metadata` (public)
  - OIDC client: `openmetadata-oidc-confidential` / `openmetadata-oidc-secret`
    (confidential). The secret is a throwaway fixture credential, committed on
    purpose like the password above — it is what makes a confidential-client leg
    testable without provisioning an external app registration.

Use the matching Playwright provider type:

```bash
SSO_PROVIDER_TYPE=keycloak-azure-saml \
SSO_USERNAME=azure.saml@openmetadata.local \
SSO_PASSWORD=OpenMetadata@123 \
npx playwright test playwright/e2e/Auth/SSOLogin.spec.ts --project=sso-auth --workers=1
```

The confidential OIDC renewal suite rides the same provider type and container:

```bash
SSO_PROVIDER_TYPE=keycloak-azure-saml \
SSO_USERNAME=azure.saml@openmetadata.local \
SSO_PASSWORD=OpenMetadata@123 \
npx playwright test playwright/e2e/Auth/SSORenewal.spec.ts --project=sso-auth --workers=1
```

The OIDC leg has OM fetch discovery and JWKS itself, so the server needs a route
to the fixture that resolves from *inside* its own container. The nightly workflow
joins the fixture to OM's network with
`docker network connect ometa_network openmetadata-keycloak-saml`; a host-run OM
server instead reaches the published port via
`KEYCLOAK_INTERNAL_BASE_URL=http://localhost:8080`.

To move Keycloak off `8080`, change all three together: `KEYCLOAK_SAML_PORT` (the
published host port), `KEYCLOAK_HOSTNAME` (the issuer/frontchannel URL Keycloak
advertises), and `KEYCLOAK_SAML_BASE_URL` (the address Playwright drives). Setting
`KEYCLOAK_SAML_PORT` alone only remaps the host port — Keycloak still advertises
`8080` and Playwright still connects to it.
