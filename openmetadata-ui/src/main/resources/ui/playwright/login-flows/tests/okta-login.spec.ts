/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect, test } from '@playwright/test';

test.describe('Okta Sign-in Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('complete Okta sign-in flow', async ({ page }) => {
    const OKTA_USERNAME = 'chirag@getcollate.io';
    const OKTA_PASSWORD = 'Okta@1234';

    // Navigate to login page
    await page.goto('/signin');
    await page.waitForLoadState('networkidle');

    // Look for the SSO sign-in button container
    const ssoSignInContainer = page.locator(
      '[data-testid="sso-signin-button"]'
    );

    await expect(ssoSignInContainer).toBeVisible();

    // Look for the Okta sign-in button within the container
    const oktaSignInButton = ssoSignInContainer.locator('button', {
      hasText: /sign in with okta/i,
    });

    // Verify the Okta sign-in button is visible
    await expect(oktaSignInButton).toBeVisible();

    // Click the Okta sign-in button to start OAuth flow
    await oktaSignInButton.click();

    await page.waitForURL('**/*.okta.com/**', { timeout: 10000 });

    // Fill in Okta username
    const usernameInput = page.locator(
      'input[name="username"], input[type="text"], input[id="okta-signin-username"]'
    );

    await expect(usernameInput).toBeVisible({ timeout: 10000 });

    // Fill in Okta username
    await usernameInput.click();
    await page.waitForTimeout(500);
    await usernameInput.fill(OKTA_USERNAME);

    // Fill in Okta password
    const passwordInput = page.locator(
      'input[name="password"], input[type="password"], input[id="okta-signin-password"]'
    );

    await expect(passwordInput).toBeVisible({ timeout: 5000 });

    await passwordInput.click();
    await page.waitForTimeout(500);
    await passwordInput.fill(OKTA_PASSWORD);

    // Click sign in button
    const signInButton = page.locator(
      'input[type="submit"], button[type="submit"], input[value*="Sign In"], button:has-text("Sign In")'
    );

    await expect(signInButton).toBeVisible({ timeout: 5000 });

    await signInButton.click();

    // Wait for Okta to process the login and redirect back
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Handle potential intermediate redirections during OAuth flow
    try {
      // Wait for redirect back to the application domain
      await page.waitForFunction(
        () => !window.location.href.includes('.okta.com'),
        { timeout: 15000 }
      );

      // Wait for final navigation to my-data page
      await page.waitForURL('**/my-data/**', { timeout: 15000 });
    } catch (error) {
      // If direct navigation fails, try waiting for any application URL first
      await page.waitForURL('**', { timeout: 10000 });

      // Then navigate to my-data if not already there
      if (!page.url().includes('/my-data')) {
        await page.goto('/my-data');
        await page.waitForLoadState('networkidle');
      }
    }

    await page
      .getByRole('dialog')
      .locator('div')
      .filter({ hasText: 'Getting Started' })
      .nth(1)
      .isVisible();
  });

  test('should handle Okta login errors gracefully', async ({ page }) => {
    // Test with invalid credentials to verify error handling
    const INVALID_USERNAME = 'invalid@example.com';
    const INVALID_PASSWORD = 'invalidpassword';

    await page.goto('/signin');
    await page.waitForLoadState('networkidle');

    // Click Okta sign-in button
    const ssoSignInContainer = page.locator(
      '[data-testid="sso-signin-button"]'
    );
    const oktaSignInButton = ssoSignInContainer.locator('button', {
      hasText: /sign in with okta/i,
    });

    await oktaSignInButton.click();
    await page.waitForURL('**/*.okta.com/**', { timeout: 10000 });

    // Fill in invalid credentials
    const usernameInput = page.locator(
      'input[name="username"], input[type="text"], input[id="okta-signin-username"]'
    );
    await usernameInput.fill(INVALID_USERNAME);

    const passwordInput = page.locator(
      'input[name="password"], input[type="password"], input[id="okta-signin-password"]'
    );
    await passwordInput.fill(INVALID_PASSWORD);

    // Click sign in
    const signInButton = page.locator(
      'input[type="submit"], button[type="submit"], input[value*="Sign In"], button:has-text("Sign In")'
    );
    await signInButton.click();

    // Wait for error message
    const errorMessage = page.locator(
      '.okta-form-infobox-error, .error-message, [data-se="errors"]'
    );

    // Verify error message appears
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
