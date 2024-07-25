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
import { expect, Page } from '@playwright/test';

export const deleteTestCase = async (page: Page, testCaseName: string) => {
  await page.getByTestId(`delete-${testCaseName}`).click();
  await page.fill('#deleteTextInput', 'DELETE');

  await expect(page.getByTestId('confirm-button')).toBeEnabled();

  await page.getByTestId('confirm-button').click();

  await expect(page.getByRole('alert')).toHaveText(/deleted successfully!/);
};
