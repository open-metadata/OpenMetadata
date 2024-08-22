/*
 *  Copyright 2024 Collate.
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
import { LOGIN_ERROR_MESSAGE } from '../../constant/login';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';

const user = new UserClass();
const CREDENTIALS = user.data;
const invalidEmail = 'userTest@openmetadata.org';
const invalidPassword = 'testUsers@123';

test.describe('Login flow should work properly', () => {
  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction, page } = await performAdminLogin(browser);
    const response = await page.request.get(
      `/api/v1/users/name/${user.getUserName()}`
    );
    user.responseData = await response.json();
    await user.delete(apiContext);
    await afterAction();
  });

  test('Signup and Login with signed up credentials', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(`/signin`);

    // Click on create account button
    await page.locator('[data-testid="signup"]').click();

    // Enter credentials
    await page.locator('#firstName').fill(CREDENTIALS.firstName);

    await expect(page.locator('#firstName')).toHaveValue(CREDENTIALS.firstName);

    await page.locator('#lastName').fill(CREDENTIALS.lastName);

    await expect(page.locator('#lastName')).toHaveValue(CREDENTIALS.lastName);

    await page.locator('#email').fill(CREDENTIALS.email);

    await expect(page.locator('#email')).toHaveValue(CREDENTIALS.email);

    await page.locator('#password').fill(CREDENTIALS.password);

    await expect(page.locator('#password')).toHaveAttribute('type', 'password');

    await page.locator('#confirmPassword').fill(CREDENTIALS.password);
    // Click on create account button
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(`/signin`);

    // Login with the created user
    await page.fill('#email', CREDENTIALS.email);
    await page.fill('#password', CREDENTIALS.password);
    await page.locator('[data-testid="login"]').click();

    await expect(page).toHaveURL(`/my-data`);

    // Verify user profile
    await page.locator('[data-testid="dropdown-profile"]').click();

    await expect(page.getByTestId('user-name')).toContainText(
      `${CREDENTIALS.firstName}${CREDENTIALS.lastName}`
    );
  });

  test('Signin using invalid credentials', async ({ page }) => {
    await page.goto(`/signin`);
    // Login with invalid email
    await page.fill('#email', invalidEmail);
    await page.fill('#password', CREDENTIALS.password);
    await page.locator('[data-testid="login"]').click();

    await expect(
      page.locator('[data-testid="login-error-container"]')
    ).toHaveText(LOGIN_ERROR_MESSAGE);

    // Login with invalid password
    await page.fill('#email', CREDENTIALS.email);
    await page.fill('#password', invalidPassword);
    await page.locator('[data-testid="login"]').click();

    await expect(
      page.locator('[data-testid="login-error-container"]')
    ).toHaveText(LOGIN_ERROR_MESSAGE);
  });

  test('Forgot password and login with new password', async ({ page }) => {
    await page.goto('/');
    // Click on Forgot button
    await page.locator('[data-testid="forgot-password"]').click();

    await expect(page).toHaveURL(`/forgot-password`);

    // Enter email
    await page.locator('#email').fill(CREDENTIALS.email);
    // Click on Forgot button
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.locator('[data-testid="go-back-button"]').click();
  });
});
