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
import { Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { redirectToHomePage } from './common';
import { sidebarClick } from './sidebar';

export const visitClassificationPage = async (
  page: Page,
  classificationName: string
) => {
  await redirectToHomePage(page);
  const classificationResponse = page.waitForResponse(
    '/api/v1/classifications?**'
  );
  await sidebarClick(page, SidebarItem.TAGS);
  await classificationResponse;
  await page.getByRole('menuitem', { name: classificationName }).click();
};
