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

export class User {
  async login(page: Page, userName: string, password: string) {
    await page.goto('/');
    await page.fill('input[id="email"]', userName);
    await page.locator('#email').press('Tab');
    await page.fill('input[id="password"]', password);
    await page.getByTestId('login').click();
  }

  async logout(page: Page) {
    await page.getByTestId('app-bar-item-logout').click();
    await page.getByTestId('confirm-logout').click();
  }
}
