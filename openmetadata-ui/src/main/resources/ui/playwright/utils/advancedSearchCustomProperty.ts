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
import { expect, Page } from '@playwright/test';

export const advanceSearchSaveFilter = async (
  page: Page,
  propertyValue: string
) => {
  const searchResponse = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset&from=0&size=15*'
  );
  await page.getByTestId('apply-btn').click();

  const res = await searchResponse;
  const json = await res.json();

  expect(JSON.stringify(json)).toContain(propertyValue);
};
