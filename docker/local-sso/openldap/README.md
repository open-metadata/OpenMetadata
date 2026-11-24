# OpenLDAP SSO Fixture

Local IdP fixture for the Playwright LDAP SSO leg (`SsoScenarios.spec.ts` under
`@ldap`). One org (`dc=openmetadata,dc=org`) + one authenticatable test user
(`uid=ldapuser`, seeded from `bootstrap.ldif`).

```bash
docker compose -f docker/local-sso/openldap/docker-compose.yml up -d
```

Runs on port `1389` by default. The OM backend then binds against
`ldap://openmetadata_openldap:1389` from inside the compose network (see the
LDAP fixture's `ldapConfiguration.host`); a host-run OM server reaches it via
the published port at `ldap://localhost:1389`.

Playwright run:

```bash
SSO_PROVIDER_TYPE=ldap \
npx playwright test playwright/e2e/Auth/SsoScenarios.spec.ts --project=sso-auth --workers=1 --grep @ldap
```

To move OpenLDAP off `1389`, set `OPENLDAP_PORT` (published host port) and
update the fixture's `LDAP_PORT` constant to match. The container's own bind
port stays fixed on `1389`.
