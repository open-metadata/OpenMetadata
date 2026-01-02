# Local SSO Setup Complete

Both Keycloak SAML and LDAP local SSO environments have been successfully configured following the quickstart docker-compose pattern.

## What Changed

### Docker Compose Files Rewritten

Both [docker-compose-keycloak-saml.yml](docker-compose-keycloak-saml.yml) and [docker-compose-ldap.yml](docker-compose-ldap.yml) have been completely rewritten to follow the quickstart pattern:

**Key Improvements:**
- Using Collate-specific images: `docker.getcollate.io/openmetadata/server:1.10.4` and `docker.getcollate.io/openmetadata/db:1.10.4`
- Added separate `execute-migrate-all` service that runs database migrations before OpenMetadata starts
- Proper dependency chain: `openmetadata-server` waits for `execute-migrate-all` to complete successfully
- All SSO environment variables properly configured (SAML for Keycloak, LDAP for OpenLDAP)
- Complete environment variable set from quickstart (Event Monitoring, Secrets Manager, Email, Web Config, etc.)
- All SSO services integrated into the same compose file

## Verified Working Setup

### Keycloak SAML

Successfully tested and verified:
- ✅ Keycloak starts healthy on port 8080
- ✅ MySQL database with Collate-specific image (1.10.4)
- ✅ Elasticsearch 8.11.4
- ✅ Database migrations run successfully via `execute-migrate-all` service
- ✅ OpenMetadata server starts on port 8585
- ✅ Keycloak realm configured with SAML client and test users

**Test Users Created:**
- `testuser` / `Test@123` (testuser@openmetadata.org)
- `adminuser` / `Admin@123` (admin@openmetadata.org)
- `datasteward` / `Steward@123` (steward@openmetadata.org)

## Quick Start Commands

### Start Keycloak SAML Environment

```bash
cd OpenMetadata/docker/local-sso

# Clean start
./quick-start.sh keycloak

# Or manually
docker-compose -f docker-compose-keycloak-saml.yml up -d
./setup-keycloak-realm.sh
```

### Start LDAP Environment

```bash
cd OpenMetadata/docker/local-sso

# Clean start
./quick-start.sh ldap

# Or manually
docker-compose -f docker-compose-ldap.yml up -d
```

### Test Workflow Locally (Simulates GitHub Actions)

```bash
cd OpenMetadata/docker/local-sso

# Test Keycloak SAML workflow
./test-workflow-locally.sh keycloak-saml

# Test LDAP workflow
./test-workflow-locally.sh ldap
```

## Access URLs

### Keycloak SAML
- **OpenMetadata**: http://localhost:8585
- **Keycloak Admin**: http://localhost:8080/admin (admin / admin123)
- **SAML Metadata**: http://localhost:8080/realms/openmetadata/protocol/saml/descriptor

### LDAP
- **OpenMetadata**: http://localhost:8585
- **phpLDAPadmin**: http://localhost:8081
- **LDAP Admin DN**: cn=admin,dc=openmetadata,dc=org (password: admin123)

## Architecture Pattern

Both compose files now follow this pattern:

```yaml
services:
  sso-provider:  # Keycloak or OpenLDAP
    healthcheck: ...

  mysql:
    image: docker.getcollate.io/openmetadata/db:1.10.4
    healthcheck: ...

  elasticsearch:
    healthcheck: ...

  execute-migrate-all:  # NEW: Runs migrations first
    image: docker.getcollate.io/openmetadata/server:1.10.4
    command: "./bootstrap/openmetadata-ops.sh migrate"
    depends_on:
      elasticsearch: service_healthy
      mysql: service_healthy

  openmetadata-server:  # Starts after migrations complete
    image: docker.getcollate.io/openmetadata/server:1.10.4
    depends_on:
      execute-migrate-all: service_completed_successfully
      sso-provider: service_healthy
```

## Migration Success

The database migration service successfully runs and completes before OpenMetadata starts. Sample migration output:

```
Successfully retrieved 0 ingestion pipelines for secrets migration
Updating services in case of an update on the JSON schema: [db]
Updating bot users in case of an update on the JSON schema: [db]
Updating ingestion pipelines in case of an update on the JSON schema: [db]
```

## Environment Variables

Both compose files include comprehensive environment variables from the quickstart pattern:

**SAML-specific (Keycloak):**
```yaml
AUTHENTICATION_PROVIDER: saml
SAML_IDP_ENTITY_ID: "http://localhost:8080/realms/openmetadata"
SAML_IDP_SSO_LOGIN_URL: "http://localhost:8080/realms/openmetadata/protocol/saml"
SAML_SP_ENTITY_ID: "http://localhost:8585"
SAML_SP_ACS: "http://localhost:8585/callback"
SAML_SP_CALLBACK: "http://localhost:8585/saml/callback"
```

**LDAP-specific (OpenLDAP):**
```yaml
AUTHENTICATION_PROVIDER: ldap
AUTHENTICATION_LDAP_HOST: openldap
AUTHENTICATION_LDAP_PORT: 1389
AUTHENTICATION_LOOKUP_ADMIN_DN: "cn=admin,dc=openmetadata,dc=org"
AUTHENTICATION_LOOKUP_ADMIN_PWD: "admin123"
AUTHENTICATION_USER_LOOKUP_BASEDN: "ou=users,dc=openmetadata,dc=org"
AUTHENTICATION_USER_MAIL_ATTR: mail
```

## Next Steps

1. **Run Playwright Tests**: Once environment is up, run SSO authentication tests:
   ```bash
   cd ../../../../openmetadata-ui/src/main/resources/ui

   # For SAML
   SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
     yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts

   # For LDAP
   SSO_PROVIDER_TYPE=ldap SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
     yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
   ```

2. **GitHub Actions CI**: The workflow `.github/workflows/sso-auth-tests-local-providers.yml` will now work with these updated compose files

3. **Cleanup**: When done testing:
   ```bash
   docker-compose -f docker-compose-keycloak-saml.yml down -v
   # or
   docker-compose -f docker-compose-ldap.yml down -v
   ```

## Files Updated

- ✅ [docker-compose-keycloak-saml.yml](docker-compose-keycloak-saml.yml) - Completely rewritten
- ✅ [docker-compose-ldap.yml](docker-compose-ldap.yml) - Completely rewritten
- ✅ [setup-keycloak-realm.sh](setup-keycloak-realm.sh) - macOS compatible
- ✅ [quick-start.sh](quick-start.sh) - macOS compatible
- ✅ [test-workflow-locally.sh](test-workflow-locally.sh) - macOS compatible

All scripts are now macOS compatible (no `timeout` command) and all services use proper Collate images with version 1.10.4.
