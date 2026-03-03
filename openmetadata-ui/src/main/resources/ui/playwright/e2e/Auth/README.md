# SSO Authentication Test Suite

Comprehensive Playwright E2E tests for OpenMetadata SSO authentication covering all major scenarios including login, logout, token refresh, multi-tab synchronization, and edge cases.

## Test Coverage Summary

### Core Authentication Flows (6 tests)
- ✅ **SSO-001**: Successful SSO login flow
- ✅ **SSO-002**: Logout flow clears authentication state
- ✅ **SSO-003**: Cannot access protected routes after logout
- ✅ **SSO-004**: Direct URL access without auth redirects to signin

### Token Refresh & Expiry (4 tests)
- ✅ **SSO-005**: Token refresh before expiry (with 2-minute token for testing)
- ✅ **SSO-006**: Expired token forces re-authentication
- ✅ **SSO-007**: Token persists across page reloads

### Multi-Tab Scenarios (4 tests)
- ✅ **SSO-008**: Login in one tab reflects in other tabs
- ✅ **SSO-009**: Logout in one tab logs out all tabs
- ✅ **SSO-010**: Token refresh in one tab updates all tabs
- ✅ **SSO-011**: Multiple tabs operate independently without conflicts

### Edge Cases (7 tests)
- ✅ **SSO-012**: Login → Logout → Login flow works correctly
- ✅ **SSO-013**: Browser refresh during login flow
- ✅ **SSO-014**: Simultaneous login attempts from multiple tabs
- ✅ **SSO-015**: Callback page handles errors gracefully
- ✅ **SSO-016**: Stale authentication state is cleaned up
- ✅ **SSO-017**: Network interruption during logout
- ✅ **SSO-018**: Cross-domain callback handling

**Total: 18 comprehensive tests**

## Supported SSO Providers

The test suite supports the following SSO providers:

1. **Google** (`google`)
2. **Okta** (`okta`)
3. **Azure AD** (`azure`)
4. **Auth0** (`auth0`)
5. **SAML** (`saml`)
6. **AWS Cognito** (`cognito`)

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the UI root directory or set environment variables:

```bash
# For Google SSO
SSO_PROVIDER_TYPE=google
SSO_USERNAME=your-email@gmail.com
SSO_PASSWORD=your-password

# For Okta SSO
SSO_PROVIDER_TYPE=okta
SSO_USERNAME=your-username@company.com
SSO_PASSWORD=your-password

# For Azure AD SSO
SSO_PROVIDER_TYPE=azure
SSO_USERNAME=your-username@company.onmicrosoft.com
SSO_PASSWORD=your-password

# For Auth0 SSO
SSO_PROVIDER_TYPE=auth0
SSO_USERNAME=your-username@company.com
SSO_PASSWORD=your-password

# For SAML SSO
SSO_PROVIDER_TYPE=saml
SSO_USERNAME=your-saml-username
SSO_PASSWORD=your-password

# For AWS Cognito SSO
SSO_PROVIDER_TYPE=cognito
SSO_USERNAME=your-username
SSO_PASSWORD=your-password

# Optional: Custom base URL
PLAYWRIGHT_TEST_BASE_URL=http://localhost:8585
```

### 2. Backend Configuration

Ensure your OpenMetadata backend is configured with the appropriate SSO provider:

**For Google:**
```yaml
authenticationConfiguration:
  provider: google
  publicKeyUrls:
    - https://www.googleapis.com/oauth2/v3/certs
  authority: https://accounts.google.com
  clientId: ${GOOGLE_CLIENT_ID}
  callbackUrl: http://localhost:8585/callback
```

**For Okta:**
```yaml
authenticationConfiguration:
  provider: okta
  publicKeyUrls:
    - ${OKTA_DOMAIN}/oauth2/v1/keys
  authority: ${OKTA_DOMAIN}/oauth2/default
  clientId: ${OKTA_CLIENT_ID}
  callbackUrl: http://localhost:8585/callback
```

**For Azure AD:**
```yaml
authenticationConfiguration:
  provider: azure
  publicKeyUrls:
    - https://login.microsoftonline.com/common/discovery/v2.0/keys
  authority: https://login.microsoftonline.com/${TENANT_ID}
  clientId: ${AZURE_CLIENT_ID}
  callbackUrl: http://localhost:8585/callback
```

**For Auth0:**
```yaml
authenticationConfiguration:
  provider: auth0
  publicKeyUrls:
    - https://${AUTH0_DOMAIN}/.well-known/jwks.json
  authority: https://${AUTH0_DOMAIN}/
  clientId: ${AUTH0_CLIENT_ID}
  callbackUrl: http://localhost:8585/callback
```

### 3. Running Tests

#### Run all SSO authentication tests:
```bash
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
```

#### Run specific test:
```bash
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "SSO-001"
```

#### Run with UI mode (for debugging):
```bash
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --ui
```

#### Run with headed browser (see what's happening):
```bash
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts --headed
```

#### Run specific test group:
```bash
# Core flows only
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "Core Flows"

# Multi-tab scenarios only
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "Multi-Tab"

# Token refresh tests only
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "Token Refresh"

# Edge cases only
yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts -g "Edge Cases"
```

## Test Architecture

### Token Storage Detection

The test suite automatically detects and works with both storage mechanisms:

1. **Service Worker + IndexedDB** (Primary)
   - Secure token storage in IndexedDB
   - Accessed via Service Worker messages

2. **localStorage** (Fallback)
   - Used when Service Worker is unavailable
   - Backward compatibility

### Helper Functions

#### `getTokenFromStorage(page)`
Retrieves the authentication token from storage (SW or localStorage).

#### `clearTokenFromStorage(page)`
Clears all authentication data from storage.

#### `waitForTokenInStorage(page, timeout)`
Waits for token to appear in storage (useful after login).

#### `getJWTExpiry(token)`
Decodes JWT and extracts expiry timestamp.

### SSO Provider Login Implementations

Each provider has a custom login function in `ssoProviderLogins` object:
- Handles provider-specific login pages
- Fills credentials
- Handles MFA/2FA prompts (if needed)
- Waits for successful authentication

## Customization Guide

### Adding a New SSO Provider

1. Add provider configuration to `.env`:
```bash
SSO_PROVIDER_TYPE=myProvider
```

2. Add login implementation in test file:
```typescript
const ssoProviderLogins = {
  // ... existing providers

  async myProvider(page: any, username: string, password: string) {
    // Wait for provider login page
    await page.waitForURL('**/my-provider.com/**', { timeout: 10000 });

    // Fill credentials
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    // Submit
    await page.click('button[type="submit"]');
  }
};
```

3. Update SSO login button selector if needed:
```typescript
const ssoLoginButton = page.locator(
  'button:has-text("Continue with MyProvider")'
);
```

### Adjusting Timeouts

For slower environments or networks, adjust timeouts:

```typescript
// Increase test timeout (default: 60s)
test.setTimeout(120000); // 2 minutes

// Increase navigation timeout
await page.goto('/my-data', { timeout: 30000 });

// Increase element wait timeout
await element.waitFor({ timeout: 15000 });
```

### Skipping Tests

To skip certain tests in CI or specific environments:

```typescript
test.skip(
  process.env.CI === 'true' && process.env.SSO_PROVIDER_TYPE === 'saml',
  'SAML not configured in CI'
);
```

## Debugging Tips

### 1. Enable Debug Mode
```bash
DEBUG=pw:api yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts
```

### 2. Take Screenshots on Failure
Tests automatically capture screenshots on failure in `playwright/output/test-results/`.

### 3. View Test Traces
```bash
yarn playwright show-trace playwright/output/test-results/[test-name]/trace.zip
```

### 4. Inspect Storage State
Add this in your test to log storage contents:
```typescript
const storage = await page.evaluate(() => {
  return {
    localStorage: { ...localStorage },
    indexedDB: indexedDB.databases()
  };
});
console.log('Storage:', storage);
```

### 5. Monitor Network Requests
```typescript
page.on('request', request => {
  console.log('>>>', request.method(), request.url());
});

page.on('response', response => {
  console.log('<<<', response.status(), response.url());
});
```

## Common Issues & Solutions

### Issue: "Token not found in storage within timeout"

**Possible Causes:**
- Service Worker not registered
- Login flow didn't complete
- Callback failed

**Solutions:**
1. Check Service Worker is active:
```typescript
await page.evaluate(() => navigator.serviceWorker.ready);
```

2. Increase timeout:
```typescript
await waitForTokenInStorage(page, 30000); // 30 seconds
```

3. Check callback URL configuration matches your setup

### Issue: "Cannot find SSO login button"

**Cause:** Button selector doesn't match your UI

**Solution:** Update the selector:
```typescript
const ssoLoginButton = page.locator('[data-testid="sso-login-button"]');
```

### Issue: "Test times out during SSO provider login"

**Possible Causes:**
- Wrong credentials
- MFA/2FA enabled
- Provider-specific security checks

**Solutions:**
1. Use test account without MFA
2. Add MFA handling in provider login function
3. Check provider console for security blocks

### Issue: "Multi-tab tests fail randomly"

**Cause:** Race conditions in storage events

**Solution:** Add explicit waits:
```typescript
await page.waitForTimeout(2000); // Wait for storage event propagation
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: SSO Auth Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        provider: [google, okta, azure]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install

      - name: Install Playwright
        run: yarn playwright install --with-deps chromium

      - name: Run SSO tests
        env:
          SSO_PROVIDER_TYPE: ${{ matrix.provider }}
          SSO_USERNAME: ${{ secrets[format('{0}_USERNAME', matrix.provider)] }}
          SSO_PASSWORD: ${{ secrets[format('{0}_PASSWORD', matrix.provider)] }}
        run: yarn playwright test playwright/e2e/Auth/SSOAuthentication.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-${{ matrix.provider }}
          path: playwright/output/playwright-report/
```

## Performance Considerations

### Test Execution Times (Approximate)

- **Core Flows**: ~5 minutes (4 tests)
- **Token Refresh**: ~6 minutes (3 tests, includes waiting for token expiry)
- **Multi-Tab**: ~8 minutes (4 tests, includes tab coordination)
- **Edge Cases**: ~10 minutes (7 tests, various scenarios)

**Total execution time: ~30 minutes** (with standard timeouts)

### Optimization Tips

1. **Run tests in parallel** (when possible):
```typescript
// playwright.config.ts
fullyParallel: true,
workers: 4
```

2. **Skip token refresh tests in development**:
```bash
yarn playwright test --grep-invert "Token Refresh"
```

3. **Use shorter token expiry for faster refresh tests**:
```typescript
JWT_EXPIRY_TIME_MAP['1 minute']: 60
```

## Best Practices

1. **Always clean up after tests**: Tests handle cleanup in `finally` blocks
2. **Use unique test data**: Generate unique identifiers for test users
3. **Handle async operations**: Always await promises
4. **Test in isolation**: Each test should be independent
5. **Mock when appropriate**: Consider mocking SSO responses for unit tests

## Security Considerations

⚠️ **IMPORTANT SECURITY NOTES:**

1. **Never commit credentials** to version control
2. **Use environment variables** or secret management
3. **Rotate test credentials** regularly
4. **Use dedicated test accounts** with minimal permissions
5. **Enable audit logging** for test accounts
6. **Review test results** for security issues

## Support & Contribution

### Reporting Issues

When reporting test failures, include:
- SSO provider type
- Full test output
- Screenshots/traces
- Environment details (OS, browser, Node version)

### Contributing

To add new test cases:

1. Follow existing test structure
2. Add descriptive test ID (SSO-XXX)
3. Document test purpose
4. Handle cleanup properly
5. Update this README

## References

- [Playwright Documentation](https://playwright.dev/)
- [OpenMetadata Authentication](https://docs.open-metadata.org/deployment/security)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [OIDC Spec](https://openid.net/connect/)
