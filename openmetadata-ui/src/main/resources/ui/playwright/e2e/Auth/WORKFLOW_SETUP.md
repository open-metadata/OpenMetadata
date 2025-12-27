# SSO Authentication Tests - Workflow Setup Guide

This guide explains how to set up the nightly SSO authentication tests workflow in GitHub Actions.

## Workflow Overview

The SSO authentication tests run automatically every night at 2 AM UTC to verify all SSO providers are working correctly. The workflow can also be triggered manually for on-demand testing.

**Workflow File:** `.github/workflows/sso-auth-tests-nightly.yml`

## Features

✅ **Nightly automated execution** at 2 AM UTC
✅ **Manual trigger** with provider selection
✅ **Matrix strategy** to test multiple providers in parallel
✅ **Full test artifacts** including traces, screenshots, and logs
✅ **Automatic notifications** on test failures
✅ **Configurable timeout** (60 minutes max)

## Prerequisites

### 1. GitHub Repository Secrets

You need to configure the following secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### For Each SSO Provider:

**Google:**
```
GOOGLE_SSO_CLIENT_ID=<your-google-client-id>
GOOGLE_SSO_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_SSO_USERNAME=test@gmail.com
GOOGLE_SSO_PASSWORD=<test-account-password>
```

**Okta:**
```
OKTA_DOMAIN=https://your-domain.okta.com
OKTA_CLIENT_ID=<your-okta-client-id>
OKTA_CLIENT_SECRET=<your-okta-client-secret>
OKTA_SSO_USERNAME=test@company.com
OKTA_SSO_PASSWORD=<test-account-password>
```

**Azure AD:**
```
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-azure-client-id>
AZURE_CLIENT_SECRET=<your-azure-client-secret>
AZURE_SSO_USERNAME=test@company.onmicrosoft.com
AZURE_SSO_PASSWORD=<test-account-password>
```

**Auth0:**
```
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=<your-auth0-client-id>
AUTH0_CLIENT_SECRET=<your-auth0-client-secret>
AUTH0_SSO_USERNAME=test@company.com
AUTH0_SSO_PASSWORD=<test-account-password>
```

**SAML:**
```
SAML_SSO_USERNAME=<your-saml-username>
SAML_SSO_PASSWORD=<test-account-password>
```

**AWS Cognito:**
```
COGNITO_SSO_USERNAME=<your-cognito-username>
COGNITO_SSO_PASSWORD=<test-account-password>
```

### 2. Test Accounts

For each provider, create dedicated test accounts:

- ❌ **Do NOT use 2FA/MFA** on test accounts
- ✅ Use minimal permissions
- ✅ Rotate credentials regularly
- ✅ Monitor account activity
- ✅ Use provider-specific test environments if available

## Running the Workflow

### Automatic Nightly Run

The workflow runs automatically every night at 2 AM UTC. No action required.

**Schedule:** `0 2 * * *` (cron expression)

### Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select **"SSO Authentication Tests (Nightly)"**
3. Click **"Run workflow"**
4. Select SSO provider to test:
   - `google` - Test Google SSO only
   - `okta` - Test Okta SSO only
   - `azure` - Test Azure AD SSO only
   - `auth0` - Test Auth0 SSO only
   - `saml` - Test SAML SSO only
   - `cognito` - Test AWS Cognito SSO only
   - `all` - Test all configured providers

5. Click **"Run workflow"** button

## Workflow Steps

The workflow performs the following steps for each provider:

1. **Checkout code** - Fetches the repository
2. **Setup Node.js 18** - Installs Node.js with Yarn caching
3. **Setup Java 21** - Installs Java with Maven caching
4. **Install UI dependencies** - Runs `yarn install`
5. **Install Playwright browsers** - Installs Chromium with dependencies
6. **Build backend** - Compiles OpenMetadata server
7. **Start server** - Launches OpenMetadata with SSO configuration
8. **Run tests** - Executes SSO authentication test suite
9. **Upload artifacts** - Saves test results, traces, and logs
10. **Stop server** - Gracefully shuts down OpenMetadata
11. **Notify on failure** - Sends notifications if tests fail

## Test Artifacts

After each run, the following artifacts are available for 7 days:

### On Success:
- **Test Results** - HTML report with test execution details
- **Screenshots** - Only on test failures
- **Coverage** - Test coverage metrics

### On Failure:
- **Test Traces** - Full Playwright traces for debugging
- **Server Logs** - OpenMetadata server logs
- **Screenshots** - Visual evidence of failures
- **Video Recordings** - Screen recordings of failed tests

**Download artifacts:**
1. Go to workflow run
2. Scroll to **"Artifacts"** section
3. Click artifact name to download

## Excluded from Regular Test Runs

The SSO authentication tests are **automatically excluded** from regular Playwright test runs to:

✅ Avoid requiring SSO credentials for local development
✅ Prevent accidental execution in CI/CD
✅ Keep regular test runs fast
✅ Isolate SSO-specific testing

**Configuration:** `playwright.config.ts`
```typescript
testIgnore: [
  '**/Auth/SSOAuthentication.spec.ts', // SSO tests run separately
]
```

## Running Tests Locally

If you want to run SSO tests locally:

```bash
# Set environment variables
export SSO_PROVIDER_TYPE=google
export SSO_USERNAME=your-test@gmail.com
export SSO_PASSWORD=your-password

# Run tests
cd openmetadata-ui/src/main/resources/ui
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
```

**Important:** Tests will NOT run as part of:
- `yarn test` - Regular unit tests
- `yarn playwright test` - Regular E2E tests
- CI/CD pipelines (except nightly workflow)

## Monitoring and Notifications

### View Test Results

**Actions Tab:**
1. Click **Actions**
2. Select **"SSO Authentication Tests (Nightly)"**
3. Click on latest run
4. View test results and logs

**Email Notifications:**
- Automatic email sent on workflow failure
- Configure in GitHub Settings → Notifications

### Custom Notifications

To add custom notifications (Slack, Teams, etc.), update the `notify` job in the workflow:

```yaml
notify:
  needs: sso-auth-tests
  if: failure()
  steps:
    - name: Send Slack notification
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {
            "text": "SSO Auth tests failed",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "SSO Authentication tests failed"
                }
              }
            ]
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Troubleshooting

### Tests Fail to Start

**Problem:** Server doesn't start
**Solution:**
- Check Java version (requires 21)
- Verify Maven build completes
- Check port 8585 availability

### SSO Login Fails

**Problem:** Provider-specific login errors
**Solution:**
- Verify credentials in secrets
- Check test account has no 2FA
- Ensure callback URLs are configured
- Review provider-specific logs

### Timeout Errors

**Problem:** Tests timeout after 60 minutes
**Solution:**
- Increase timeout in workflow (max recommended: 120 min)
- Check network latency
- Verify provider availability

### Flaky Tests

**Problem:** Tests pass sometimes, fail others
**Solution:**
- Download trace artifacts
- Check for timing issues
- Verify provider rate limits
- Review concurrent execution conflicts

## Best Practices

1. **Rotate Credentials Monthly** - Update test account passwords regularly
2. **Monitor Usage** - Track test account activity for anomalies
3. **Review Artifacts** - Check traces after failures
4. **Update Tests** - Keep tests aligned with UI changes
5. **Document Changes** - Update this guide when modifying workflow

## Security Considerations

⚠️ **Important Security Notes:**

1. **Never commit credentials** to repository
2. **Use repository secrets** for all sensitive data
3. **Limit secret access** to necessary workflows
4. **Enable audit logs** for secret access
5. **Rotate secrets** if compromised
6. **Use least privilege** for test accounts
7. **Monitor failed login attempts**
8. **Disable unused test accounts**

## Customization

### Change Schedule

Edit cron expression in workflow:

```yaml
schedule:
  - cron: '0 2 * * *'  # 2 AM UTC daily
  # - cron: '0 2 * * 1-5'  # Weekdays only
  # - cron: '0 2 * * 0'  # Sundays only
```

### Add New Provider

1. Add provider to `ssoAuthUtils.ts`
2. Add provider credentials to secrets
3. Update workflow matrix:

```yaml
matrix:
  provider: [..., 'newprovider']
```

4. Update secret references:

```yaml
env:
  NEWPROVIDER_SSO_USERNAME: ${{ secrets.NEWPROVIDER_SSO_USERNAME }}
```

### Adjust Timeout

Modify workflow timeout:

```yaml
jobs:
  sso-auth-tests:
    timeout-minutes: 120  # Increase from 60 to 120
```

## Support

For issues or questions:

1. Check [QUICK_START.md](./QUICK_START.md) for basic setup
2. Review [README.md](./README.md) for detailed documentation
3. Check workflow run logs for error details
4. Open GitHub issue with workflow run link

---

**Workflow Status:** [![SSO Auth Tests](../../../../../../.github/workflows/sso-auth-tests-nightly.yml/badge.svg)](../../../../../../actions/workflows/sso-auth-tests-nightly.yml)
