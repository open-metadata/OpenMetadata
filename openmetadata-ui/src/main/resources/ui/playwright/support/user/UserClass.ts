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
import { APIRequestContext, Page } from '@playwright/test';
import { generateRandomUsername } from '../../utils/user';

type ResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  id: string;
  fullyQualifiedName: string;
};

export class UserClass {
  data = generateRandomUsername();

  responseData: ResponseDataType;

  async create(apiContext: APIRequestContext) {
    const response = await apiContext.post('/api/v1/users/signup', {
      data: this.data,
    });

    this.responseData = await response.json();

    return response.body;
  }

  async delete(apiContext: APIRequestContext) {
    const response = await apiContext.delete(
      `/api/v1/users/${this.responseData.id}?recursive=false&hardDelete=true`
    );

    return response.body;
  }

  getUserName() {
    return `${this.data.firstName}${this.data.lastName}`;
  }

  async login(
    page: Page,
    userName = this.data.email,
    password = this.data.password
  ) {
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
