# Testing GitHub Actions Workflow Locally

This guide shows you how to test the SSO CI/CD workflow locally before pushing to GitHub.

## 🚀 Quick Start (Recommended Method)

The easiest way to test the workflow is using the **test-workflow-locally.sh** script, which simulates exactly what GitHub Actions does:

```bash
cd OpenMetadata/docker/local-sso

# Test Keycloak SAML workflow
./test-workflow-locally.sh keycloak-saml

# Test LDAP workflow
./test-workflow-locally.sh ldap
```

This script:
1. ✅ Cleans up existing containers
2. ✅ Starts SSO provider (Keycloak or LDAP)
3. ✅ Configures realm/directory with test users
4. ✅ Starts OpenMetadata with correct config
5. ✅ Runs Playwright tests
6. ✅ Shows results and artifacts

---

## 📋 Manual Step-by-Step Testing

If you want to test each step manually:

### For Keycloak SAML

```bash
# 1. Navigate to directory
cd OpenMetadata/docker/local-sso

# 2. Start Keycloak
docker network create openmetadata-sso || true
docker run -d \
  --name keycloak-saml \
  --network openmetadata-sso \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin123 \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

# 3. Wait for Keycloak to be ready
timeout 120 bash -c 'until curl -f http://localhost:8080/health/ready; do sleep 2; done'

# 4. Configure Keycloak realm
./setup-keycloak-realm.sh

# 5. Start OpenMetadata services
docker-compose -f docker-compose-keycloak-saml.yml up -d

# 6. Wait for OpenMetadata
timeout 180 bash -c 'until curl -f http://localhost:8585/api/v1/system/status; do sleep 5; done'

# 7. Run Playwright tests
cd ../../../../openmetadata-ui/src/main/resources/ui
SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --workers=1

# 8. View results
yarn playwright show-report
```

### For LDAP

```bash
# 1. Navigate to directory
cd OpenMetadata/docker/local-sso

# 2. Start OpenLDAP
docker network create openmetadata-sso || true
docker run -d \
  --name openldap \
  --network openmetadata-sso \
  -p 389:1389 \
  -e LDAP_ORGANISATION="OpenMetadata" \
  -e LDAP_DOMAIN="openmetadata.org" \
  -e LDAP_ADMIN_PASSWORD="admin123" \
  osixia/openldap:1.5.0

# 3. Wait for LDAP to initialize
sleep 15

# 4. Add test users (copy from ldap-init.ldif)
docker cp ldap-init.ldif openldap:/tmp/
docker exec openldap ldapadd -x \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123 \
  -f /tmp/ldap-init.ldif

# 5. Start OpenMetadata services
docker-compose -f docker-compose-ldap.yml up -d

# 6. Wait for OpenMetadata
timeout 180 bash -c 'until curl -f http://localhost:8585/api/v1/system/status; do sleep 5; done'

# 7. Run Playwright tests
cd ../../../../openmetadata-ui/src/main/resources/ui
SSO_PROVIDER_TYPE=ldap SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --workers=1

# 8. View results
yarn playwright show-report
```

---

## 🔧 Using `act` (GitHub Actions Runner)

For a more authentic GitHub Actions experience, use [act](https://github.com/nektos/act):

### Install act

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (with Chocolatey)
choco install act-cli
```

### Run Workflow with act

```bash
cd OpenMetadata

# List available workflows
act -l

# Run SSO workflow with Keycloak SAML
act workflow_dispatch \
  -W .github/workflows/sso-auth-tests-local-providers.yml \
  --matrix provider:keycloak-saml \
  --container-architecture linux/amd64

# Run with LDAP
act workflow_dispatch \
  -W .github/workflows/sso-auth-tests-local-providers.yml \
  --matrix provider:ldap \
  --container-architecture linux/amd64

# Run with specific input
act workflow_dispatch \
  -W .github/workflows/sso-auth-tests-local-providers.yml \
  --input sso_provider=keycloak-saml

# Dry run (show what would execute)
act workflow_dispatch \
  -W .github/workflows/sso-auth-tests-local-providers.yml \
  --matrix provider:keycloak-saml \
  --dryrun
```

### act Configuration

Create `.actrc` in the OpenMetadata root:

```bash
cat > .actrc << 'EOF'
# Use large runner image for better compatibility
-P ubuntu-latest=catthehacker/ubuntu:full-latest

# Docker socket access
--container-daemon-socket -

# Set secrets (if needed)
-s GITHUB_TOKEN=ghp_fake_token_for_local_testing

# Verbose output
--verbose
EOF
```

### Known Limitations with act

⚠️ **Docker-in-Docker Issues**: The workflow starts Docker containers, which can be problematic with act
⚠️ **Resource Intensive**: Requires significant CPU and memory
⚠️ **Some Features Unsupported**: GitHub-specific actions may not work perfectly

**Recommendation**: Use `test-workflow-locally.sh` instead of `act` for testing this particular workflow.

---

## 🧪 Testing Individual Components

### Test Just the SSO Setup

```bash
# Start environment only
cd OpenMetadata/docker/local-sso
./quick-start.sh keycloak  # or ldap

# Verify manually
open http://localhost:8585
# Try logging in with: testuser / Test@123
```

### Test Just Playwright Tests

```bash
# Assuming SSO environment is already running
cd openmetadata-ui/src/main/resources/ui

# Run specific test
SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "SSO-001"

# Run with UI mode (for debugging)
SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --ui

# Run in headed mode (see browser)
SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --headed
```

### Test Just Keycloak Configuration

```bash
cd OpenMetadata/docker/local-sso

# Start Keycloak only
docker run -d \
  --name keycloak-test \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin123 \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

# Wait for ready
timeout 120 bash -c 'until curl -f http://localhost:8080/health/ready; do sleep 2; done'

# Run configuration script
./setup-keycloak-realm.sh

# Verify in admin console
open http://localhost:8080/admin
# Login: admin / admin123
# Check: Realm "openmetadata" exists with users
```

---

## 📊 Viewing Test Results

### Playwright HTML Report

```bash
cd openmetadata-ui/src/main/resources/ui

# Open HTML report in browser
yarn playwright show-report

# Or manually
open playwright/output/playwright-report/index.html
```

### View Test Traces

```bash
# List trace files
ls playwright/output/test-results/**/trace.zip

# View specific trace
yarn playwright show-trace playwright/output/test-results/[test-name]/trace.zip
```

### Check Container Logs

```bash
# Keycloak
docker logs keycloak-saml

# LDAP
docker logs openldap

# OpenMetadata
docker logs openmetadata-server

# MySQL
docker logs openmetadata_mysql

# Elasticsearch
docker logs openmetadata-elasticsearch
```

---

## 🐛 Debugging Failed Tests

### Enable Playwright Debug Mode

```bash
cd openmetadata-ui/src/main/resources/ui

# Run with debugger
PWDEBUG=1 SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts

# Run with verbose logging
DEBUG=pw:api SSO_PROVIDER_TYPE=saml SSO_USERNAME=testuser SSO_PASSWORD=Test@123 \
  yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
```

### Check Service Health

```bash
# Check all containers are running
docker ps

# Check Keycloak health
curl http://localhost:8080/health/ready

# Check OpenMetadata status
curl http://localhost:8585/api/v1/system/status

# Check Elasticsearch
curl http://localhost:9200/_cluster/health

# Test LDAP connection
ldapsearch -x -H ldap://localhost:389 \
  -b "dc=openmetadata,dc=org" \
  -D "cn=admin,dc=openmetadata,dc=org" \
  -w admin123
```

### Common Issues

**Issue: Keycloak not ready**
```bash
# Check logs
docker logs keycloak-saml

# Restart with fresh state
docker stop keycloak-saml && docker rm keycloak-saml
# Then re-run setup
```

**Issue: OpenMetadata can't connect to Keycloak**
```bash
# Check network
docker network inspect openmetadata-sso

# Verify Keycloak is on the network
docker network connect openmetadata-sso keycloak-saml

# Test connectivity from OpenMetadata container
docker exec openmetadata-server curl http://keycloak:8080/health/ready
```

**Issue: Tests timeout**
```bash
# Increase timeouts in test
# Or run with more time
timeout 600 yarn playwright test ...
```

---

## 🧹 Cleanup After Testing

### Quick Cleanup

```bash
cd OpenMetadata/docker/local-sso

# Stop and remove everything
docker-compose -f docker-compose-keycloak-saml.yml down -v
docker-compose -f docker-compose-ldap.yml down -v

# Remove standalone containers
docker stop keycloak-saml openldap 2>/dev/null || true
docker rm keycloak-saml openldap 2>/dev/null || true

# Remove network
docker network rm openmetadata-sso 2>/dev/null || true

# Clean up volumes
docker volume prune -f
```

### Full System Cleanup

```bash
# Remove all test artifacts
rm -rf playwright/output/playwright-report
rm -rf playwright/output/test-results

# Remove Docker volumes
docker volume ls | grep openmetadata | awk '{print $2}' | xargs docker volume rm

# Free up disk space
docker system prune -a --volumes
```

---

## 📈 Performance Tips

### Speed Up Tests

```bash
# Run only core flows (skip slow token refresh tests)
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts \
  --grep-invert "Token Refresh"

# Run specific test by ID
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "SSO-001"

# Use faster database (in-memory)
# Edit docker-compose.yml to use tmpfs for MySQL data
```

### Reduce Docker Resource Usage

```bash
# Limit Elasticsearch memory
# In docker-compose*.yml:
# ES_JAVA_OPTS=-Xms256m -Xmx256m  (instead of 512m)

# Use smaller base images
# Already optimized in the configs
```

---

## ✅ Pre-Push Checklist

Before pushing changes that affect the workflow:

- [ ] Test workflow locally with `./test-workflow-locally.sh keycloak-saml`
- [ ] Test workflow locally with `./test-workflow-locally.sh ldap`
- [ ] Verify all Playwright tests pass
- [ ] Check no hardcoded credentials (use env vars)
- [ ] Review container logs for errors
- [ ] Clean up test artifacts
- [ ] Update documentation if workflow changes

---

## 🎯 Next Steps

1. **Run local test first**:
   ```bash
   cd OpenMetadata/docker/local-sso
   ./test-workflow-locally.sh keycloak-saml
   ```

2. **Fix any issues locally** before pushing

3. **Trigger GitHub Actions workflow** once local tests pass

4. **Monitor workflow run** in GitHub Actions UI

5. **Download artifacts** if tests fail in CI

---

## 📚 Additional Resources

- [act Documentation](https://github.com/nektos/act)
- [Playwright Debugging Guide](https://playwright.dev/docs/debug)
- [Docker Compose CLI Reference](https://docs.docker.com/compose/reference/)
- [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/)
- [OpenLDAP Admin Guide](https://www.openldap.org/doc/admin24/)
