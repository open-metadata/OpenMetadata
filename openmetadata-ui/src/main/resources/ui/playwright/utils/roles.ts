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
import { expect, Locator, Page } from '@playwright/test';

export const removePolicyFromRole = async (
  page: Page,
  policyName: string,
  roleName: string
) => {
  // Clicking on remove action for added policy
  await page.locator(`[data-testid="remove-action-${policyName}"]`).click();

  const modalText = await page.locator('.ant-modal-body').textContent();

  expect(modalText).toBe(
    `Are you sure you want to remove the ${policyName} from ${roleName}?`
  );

  await page.locator('[type="button"]:has-text("Confirm")').click();
};

// TODO: Remove this function once we have a better way to get locator using SearchBar
export const getElementWithPagination = async (
  page: Page,
  locator: Locator,
  click = true
) => {
  let hasNext = true;

  while (hasNext) {
    if (await locator.isVisible()) {
      click && (await locator.click());

      break;
    }

    const nextBtn = page.locator('[data-testid="next"]');
    await nextBtn.waitFor({ state: 'visible' });

    hasNext = !(await nextBtn.getAttribute('disabled'));

    if (!hasNext) {
      throw new Error('Element not found and no more pages to paginate.');
    }

    await nextBtn.click();

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  }
};
