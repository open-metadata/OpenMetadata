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
import { expect, Page } from '@playwright/test';

export const expectBreadcrumbCrumbsUnique = async (page: Page) => {
  const breadcrumb = page.getByTestId('breadcrumb');

  await expect(breadcrumb).toBeVisible();

  const crumbLabels = (await breadcrumb.getByRole('listitem').allInnerTexts())
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

  expect(crumbLabels.length).toBeGreaterThan(0);
  expect(new Set(crumbLabels).size).toBe(crumbLabels.length);
};
