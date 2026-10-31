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
import { ACTION_TIMEOUT } from '../../constant/common';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { installServerLoadReducers } from '../../support/fixtures/serverLoad';

test('re-seeds a worker session whose token is missing from IndexedDB at boot', async ({
  browser,
  isolatedUserSession,
}) => {
  // The session cookie restores and the token does not: the boot CI hits.
  const page = await browser.newPage({
    storageState: {
      cookies: isolatedUserSession.storageState.cookies,
      origins: [],
    },
  });

  try {
    await installServerLoadReducers(page.context());
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });

    // Two boots: the one that lands on /signin, then the guard's reload.
    await expect(
      page.getByTestId('left-sidebar').or(page.getByTestId('ask-sidebar'))
    ).toBeVisible({ timeout: ACTION_TIMEOUT });
    expect(test.info().annotations).toContainEqual(
      expect.objectContaining({ type: 'auth-token-recovered' })
    );
  } finally {
    await page.close();
  }
});
