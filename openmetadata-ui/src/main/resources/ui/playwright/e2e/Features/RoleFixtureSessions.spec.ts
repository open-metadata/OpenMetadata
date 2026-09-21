/*
 *  Copyright 2026 Collate.
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
import { Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/userPages';

/**
 * Every lane in the suite reuses the storage states `e2e/auth.setup.ts` writes.
 * If one of them is captured without a usable session, the specs that take that
 * role fail far away from the cause — with a permission error, an empty page, or
 * a timeout on something that was never going to render — and the setup itself
 * still reports green.
 *
 * These assert the contract directly: each role fixture yields a page that is
 * signed in. They are cheap (a navigation each) and they are the regression
 * guard for the sign-in mechanism `auth.setup.ts` uses — which is now the API
 * (`UserClass.signIn`) rather than the sign-in form, so a change in how the app
 * persists its token would otherwise surface as a suite-wide mystery.
 */
const expectSignedIn = async (page: Page, role: string) => {
  await page.goto('/my-data', { waitUntil: 'domcontentloaded' });

  expect(
    new URL(page.url()).pathname,
    `${role} was redirected to the sign-in page — its storage state carries no usable session`
  ).not.toContain('signin');

  await expect(
    page.getByTestId('left-sidebar'),
    `${role} did not render the app shell`
  ).toBeAttached({ timeout: 30_000 });

  await expect(
    page.getByTestId('dropdown-profile'),
    `${role} rendered the shell but no signed-in user`
  ).toBeVisible({ timeout: 30_000 });
};

test.describe('role fixture sessions', () => {
  test('adminPage is signed in', async ({ adminPage }) => {
    await expectSignedIn(adminPage, 'adminPage');
  });

  test('dataConsumerPage is signed in', async ({ dataConsumerPage }) => {
    await expectSignedIn(dataConsumerPage, 'dataConsumerPage');
  });

  test('dataStewardPage is signed in', async ({ dataStewardPage }) => {
    await expectSignedIn(dataStewardPage, 'dataStewardPage');
  });

  test('ownerPage is signed in', async ({ ownerPage }) => {
    await expectSignedIn(ownerPage, 'ownerPage');
  });

  test('editDescriptionPage is signed in', async ({ editDescriptionPage }) => {
    await expectSignedIn(editDescriptionPage, 'editDescriptionPage');
  });

  test('editTagsPage is signed in', async ({ editTagsPage }) => {
    await expectSignedIn(editTagsPage, 'editTagsPage');
  });

  test('editGlossaryTermPage is signed in', async ({
    editGlossaryTermPage,
  }) => {
    await expectSignedIn(editGlossaryTermPage, 'editGlossaryTermPage');
  });

  test('viewOnlyPage is signed in', async ({ viewOnlyPage }) => {
    await expectSignedIn(viewOnlyPage, 'viewOnlyPage');
  });
});
