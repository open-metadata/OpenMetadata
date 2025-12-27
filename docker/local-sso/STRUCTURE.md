# Local SSO Directory Structure

```
OpenMetadata/
├── .github/
│   └── workflows/
│       └── sso-auth-tests-local-providers.yml    ← GitHub Actions CI/CD workflow
│
└── docker/
    └── local-sso/                                ← New directory for local SSO testing
        ├── README.md                             ← Complete setup guide
        ├── SETUP_SUMMARY.md                      ← Quick overview
        ├── STRUCTURE.md                          ← This file
        ├── .env.example                          ← Environment variables template
        │
        ├── quick-start.sh                        ← One-command setup (keycloak|ldap)
        ├── setup-keycloak-realm.sh               ← Automated Keycloak configuration
        │
        ├── docker-compose-keycloak-saml.yml      ← Keycloak SAML environment
        ├── docker-compose-ldap.yml               ← LDAP environment
        │
        ├── openmetadata-keycloak-saml.yaml       ← OpenMetadata config for Keycloak
        ├── openmetadata-ldap.yaml                ← OpenMetadata config for LDAP
        │
        └── ldap-init.ldif                        ← LDAP initial users/groups
```

## File Purposes

### GitHub Actions
- **sso-auth-tests-local-providers.yml**
  - Automated CI/CD workflow
  - Tests both Keycloak SAML and LDAP
  - Runs nightly or on manual trigger
  - Complete with service setup and Playwright tests

### Docker Compose Files
- **docker-compose-keycloak-saml.yml**
  - Keycloak 23.0 SAML Identity Provider
  - MySQL 8.0 database
  - Elasticsearch 7.17 search
  - OpenMetadata server with SAML config
  
- **docker-compose-ldap.yml**
  - OpenLDAP 1.5.0 directory server
  - phpLDAPadmin web UI
  - MySQL 8.0 database
  - Elasticsearch 7.17 search
  - OpenMetadata server with LDAP config

### Configuration Files
- **openmetadata-keycloak-saml.yaml**
  - SAML SSO configuration
  - IDP/SP settings
  - Token validity and security
  
- **openmetadata-ldap.yaml**
  - LDAP connection settings
  - User/group base DNs
  - Attribute mappings

- **ldap-init.ldif**
  - Organizational units (users, groups)
  - 3 test users with passwords
  - Group memberships

### Helper Scripts
- **quick-start.sh**
  - Single command to start environment
  - Health checks for all services
  - Colored output with status
  - Usage: `./quick-start.sh [keycloak|ldap]`
  
- **setup-keycloak-realm.sh**
  - Creates OpenMetadata realm
  - Configures SAML client
  - Creates test users
  - Validates configuration

### Documentation
- **README.md**
  - Complete setup instructions
  - Troubleshooting guide
  - CI/CD integration
  - User management
  
- **SETUP_SUMMARY.md**
  - Quick overview
  - Architecture diagrams
  - Feature comparison
  - Next steps

- **.env.example**
  - Environment variable template
  - Configuration options
  - Playwright test settings

## Usage Flow

### Local Development
```
1. Navigate to directory
   cd OpenMetadata/docker/local-sso

2. Start environment
   ./quick-start.sh keycloak  (or ldap)

3. Access OpenMetadata
   http://localhost:8585

4. Run tests
   cd ../../../openmetadata-ui/src/main/resources/ui
   yarn playwright test ...
```

### CI/CD (GitHub Actions)
```
1. Workflow triggers (nightly or manual)
   
2. Starts Docker services
   - Keycloak/LDAP
   - MySQL, Elasticsearch
   - OpenMetadata
   
3. Configures SSO provider
   - Creates realm/directory
   - Adds test users
   
4. Runs Playwright tests
   - All 18 SSO test scenarios
   
5. Uploads results
   - Test reports
   - Traces on failure
   - Logs on failure
```

## Service Ports

### Keycloak SAML Environment
- OpenMetadata: `8585`
- Keycloak: `8080`
- Keycloak Admin: `8080/admin`
- MySQL: `3306`
- Elasticsearch: `9200`, `9300`

### LDAP Environment
- OpenMetadata: `8585`
- OpenLDAP: `389` (LDAP), `636` (LDAPS)
- phpLDAPadmin: `8081`
- MySQL: `3306`
- Elasticsearch: `9200`, `9300`

## Test Users (Both Environments)

| Username    | Password    | Email                        | Groups       |
|-------------|-------------|------------------------------|--------------|
| testuser    | Test@123    | testuser@openmetadata.org    | users        |
| adminuser   | Admin@123   | admin@openmetadata.org       | admins       |
| datasteward | Steward@123 | steward@openmetadata.org     | datastewards |

## Container Names

### Keycloak SAML
- `keycloak-saml-sso`
- `openmetadata-mysql`
- `openmetadata-elasticsearch`
- `openmetadata-server`

### LDAP
- `openldap-sso`
- `phpldapadmin`
- `openmetadata-mysql`
- `openmetadata-elasticsearch`
- `openmetadata-server`

## Networks

Both environments use isolated Docker networks:
- Network name: `openmetadata-sso`
- Driver: bridge
- Provides container-to-container communication

## Volumes

### Keycloak SAML
- `mysql-data` - MySQL database
- `es-data` - Elasticsearch indices

### LDAP
- `ldap-data` - LDAP directory data
- `ldap-config` - LDAP configuration
- `mysql-data` - MySQL database
- `es-data` - Elasticsearch indices
