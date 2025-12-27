# Local SSO Testing - Keycloak SAML & LDAP

Complete local SSO testing environment for OpenMetadata with **zero external dependencies**. Perfect for development, testing, and CI/CD pipelines.

## 🎯 Why Use This?

✅ **No Cloud Accounts Required** - Everything runs locally in Docker
✅ **No Complex Policies** - No Okta network zones, Azure conditional access, or Google OAuth consent screens
✅ **No 2FA Headaches** - Test accounts work without MFA complications
✅ **Fast Setup** - Up and running in 5-10 minutes
✅ **CI/CD Ready** - Works perfectly in GitHub Actions, GitLab CI, or any CI system
✅ **Deterministic** - Same behavior every time, no network latency or policy changes

## 🚀 Quick Start

### Option 1: Keycloak SAML (Recommended)

**Setup Time: 10 minutes**

```bash
# 1. Start Keycloak and dependencies
cd docker/local-sso
docker-compose -f docker-compose-keycloak-saml.yml up -d

# 2. Configure Keycloak realm and test users
chmod +x setup-keycloak-realm.sh
./setup-keycloak-realm.sh

# 3. Access OpenMetadata
open http://localhost:8585
# Click "Sign in with SAML"
# Username: testuser
# Password: Test@123
```

### Option 2: LDAP

**Setup Time: 5 minutes**

```bash
# 1. Start OpenLDAP and dependencies
cd docker/local-sso
docker-compose -f docker-compose-ldap.yml up -d

# 2. Access OpenMetadata (LDAP users pre-configured)
open http://localhost:8585
# Click "Sign in with LDAP"
# Username: testuser
# Password: Test@123
```

## 📦 What's Included

### Keycloak SAML Environment

- **Keycloak 23.0** - SAML Identity Provider
- **MySQL 8.0** - OpenMetadata database
- **Elasticsearch 7.17** - Search engine
- **OpenMetadata Server** - Configured for SAML SSO

**Test Users:**
- `testuser` / `Test@123` - Regular user
- `adminuser` / `Admin@123` - Admin user
- `datasteward` / `Steward@123` - Data steward

**Management UIs:**
- OpenMetadata: http://localhost:8585
- Keycloak Admin: http://localhost:8080/admin (admin/admin123)

### LDAP Environment

- **OpenLDAP 1.5.0** - Directory server
- **phpLDAPadmin** - Web-based LDAP management
- **MySQL 8.0** - OpenMetadata database
- **Elasticsearch 7.17** - Search engine
- **OpenMetadata Server** - Configured for LDAP SSO

**Test Users:**
- `testuser` / `Test@123` - Regular user (testuser@openmetadata.org)
- `adminuser` / `Admin@123` - Admin user (admin@openmetadata.org)
- `datasteward` / `Steward@123` - Data steward (steward@openmetadata.org)

**Management UIs:**
- OpenMetadata: http://localhost:8585
- phpLDAPadmin: http://localhost:8081 (admin/admin123)

## 🧪 Running Playwright Tests

### Test with Keycloak SAML

```bash
cd openmetadata-ui/src/main/resources/ui

# Create .env file
cat > .env << 'EOF'
SSO_PROVIDER_TYPE=saml
SSO_USERNAME=testuser
SSO_PASSWORD=Test@123
PLAYWRIGHT_TEST_BASE_URL=http://localhost:8585
EOF

# Run tests
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --workers=1
```

### Test with LDAP

```bash
cd openmetadata-ui/src/main/resources/ui

# Create .env file
cat > .env << 'EOF'
SSO_PROVIDER_TYPE=ldap
SSO_USERNAME=testuser
SSO_PASSWORD=Test@123
PLAYWRIGHT_TEST_BASE_URL=http://localhost:8585
EOF

# Run tests
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --workers=1
```

## 🔧 Configuration Details

### Keycloak SAML Configuration

**Realm:** `openmetadata`
**Client ID:** `http://localhost:8585`
**SAML Metadata:** http://localhost:8080/realms/openmetadata/protocol/saml/descriptor
**Name ID Format:** Email
**Assertion Consumer Service:** http://localhost:8585/callback

**Security Settings:**
- Signature Algorithm: RSA_SHA256
- Assertions Signed: Yes
- Messages Signed: No (for local testing simplicity)
- Client Signature Required: No

### LDAP Configuration

**Base DN:** `dc=openmetadata,dc=org`
**Admin DN:** `cn=admin,dc=openmetadata,dc=org`
**User Base DN:** `ou=users,dc=openmetadata,dc=org`
**Group Base DN:** `ou=groups,dc=openmetadata,dc=org`

**Port Mappings:**
- LDAP: 389 (mapped from container 1389)
- LDAPS: 636 (mapped from container 1636)

**Groups:**
- `admins` - OpenMetadata administrators
- `datastewards` - Data stewards
- `users` - All users

## 🐛 Troubleshooting

### Keycloak Issues

**Problem: Keycloak not ready**
```bash
# Check Keycloak health
curl http://localhost:8080/health/ready

# View logs
docker logs keycloak-saml-sso
```

**Problem: Realm configuration failed**
```bash
# Re-run setup script
./setup-keycloak-realm.sh

# Or manually configure via admin console
open http://localhost:8080/admin
```

**Problem: SAML login redirects but fails**
```bash
# Check OpenMetadata logs
docker logs openmetadata-server

# Verify SAML metadata is accessible
curl http://localhost:8080/realms/openmetadata/protocol/saml/descriptor
```

### LDAP Issues

**Problem: LDAP connection refused**
```bash
# Check OpenLDAP is running
docker ps | grep openldap

# Test LDAP connection
ldapsearch -x -H ldap://localhost:389 \
  -b "dc=openmetadata,dc=org" \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123
```

**Problem: Users not found**
```bash
# Verify users exist in LDAP
docker exec openldap ldapsearch -x \
  -b "ou=users,dc=openmetadata,dc=org" \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123

# Re-apply LDIF if needed
docker exec openldap ldapadd -x \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123 \
  -f /container/service/slapd/assets/config/bootstrap/ldif/custom/init.ldif
```

### General Issues

**Problem: Port conflicts**
```bash
# Change ports in docker-compose file
# Keycloak: Change 8080:8080 to 8081:8080
# OpenMetadata: Change 8585:8585 to 8586:8585
```

**Problem: Containers won't start**
```bash
# Clean up everything
docker-compose -f docker-compose-keycloak-saml.yml down -v
docker-compose -f docker-compose-ldap.yml down -v

# Remove networks
docker network prune

# Start fresh
docker-compose -f docker-compose-keycloak-saml.yml up -d
```

## 🔄 Switching Between Providers

### Stop Current Provider

```bash
# Stop Keycloak SAML
docker-compose -f docker-compose-keycloak-saml.yml down

# Stop LDAP
docker-compose -f docker-compose-ldap.yml down
```

### Start Different Provider

```bash
# Start Keycloak SAML
docker-compose -f docker-compose-keycloak-saml.yml up -d
./setup-keycloak-realm.sh

# OR start LDAP
docker-compose -f docker-compose-ldap.yml up -d
```

## 🧹 Cleanup

### Remove Everything

```bash
# Stop and remove all containers, volumes, networks
docker-compose -f docker-compose-keycloak-saml.yml down -v
docker-compose -f docker-compose-ldap.yml down -v

# Remove orphaned volumes
docker volume prune

# Remove orphaned networks
docker network prune
```

### Keep Data (Restart Later)

```bash
# Just stop containers
docker-compose -f docker-compose-keycloak-saml.yml stop
docker-compose -f docker-compose-ldap.yml stop

# Restart later
docker-compose -f docker-compose-keycloak-saml.yml start
docker-compose -f docker-compose-ldap.yml start
```

## 📊 CI/CD Integration

### GitHub Actions

See [.github/workflows/sso-auth-tests-local-providers.yml](../../.github/workflows/sso-auth-tests-local-providers.yml) for complete example.

### Quick CI Example

```yaml
jobs:
  test-sso:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Keycloak SAML
        run: |
          cd docker/local-sso
          docker-compose -f docker-compose-keycloak-saml.yml up -d
          ./setup-keycloak-realm.sh

      - name: Run Tests
        env:
          SSO_PROVIDER_TYPE: saml
          SSO_USERNAME: testuser
          SSO_PASSWORD: Test@123
        run: yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
```

## 🎓 Adding Custom Users

### Keycloak SAML

```bash
# Get admin token
TOKEN=$(curl -X POST 'http://localhost:8080/realms/master/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin' \
  -d 'password=admin123' \
  -d 'grant_type=password' \
  -d 'client_id=admin-cli' | jq -r '.access_token')

# Create user
curl -X POST 'http://localhost:8080/admin/realms/openmetadata/users' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "newuser",
    "email": "newuser@openmetadata.org",
    "firstName": "New",
    "lastName": "User",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
      "type": "password",
      "value": "Password@123",
      "temporary": false
    }]
  }'
```

### LDAP

```bash
# Create LDIF file
cat > new-user.ldif << 'EOF'
dn: uid=newuser,ou=users,dc=openmetadata,dc=org
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: newuser
cn: New User
sn: User
mail: newuser@openmetadata.org
uidNumber: 10004
gidNumber: 10004
homeDirectory: /home/newuser
userPassword: Password@123
EOF

# Add to LDAP
docker cp new-user.ldif openldap:/tmp/
docker exec openldap ldapadd -x \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123 \
  -f /tmp/new-user.ldif
```

## 📚 Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OpenLDAP Admin Guide](https://www.openldap.org/doc/admin24/)
- [OpenMetadata Security Docs](https://docs.open-metadata.org/deployment/security)
- [SAML 2.0 Specification](http://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)

## 🤝 Contributing

Found an issue or want to improve the setup?

1. Test your changes locally
2. Update documentation
3. Submit a pull request

## ⚖️ License

Apache License 2.0 - See LICENSE file for details
