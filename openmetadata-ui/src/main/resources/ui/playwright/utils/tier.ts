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
import { APIRequestContext, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';
import { setClassificationDisabled } from './tag';

export { setTagDisabled, setTagDisabledByFqn } from './tag';

export const setTierClassificationDisabled = async (
  apiContext: APIRequestContext,
  disabled: boolean
) => {
  await setClassificationDisabled(apiContext, 'Tier', disabled);
};

export const openTierDropdown = async (page: Page) => {
  const tierResponse = page.waitForResponse('/api/v1/tags?*parent=Tier*');
  await page.getByTestId('edit-tier').click();
  await tierResponse;
  await page.getByTestId('cards').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
};

export const closeTierDropdown = async (page: Page) => {
  await page.getByTestId('close-tier-card').click();
  await page.getByTestId('cards').waitFor({ state: 'hidden' });
};
