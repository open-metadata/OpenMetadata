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
import { APIRequestContext, Browser, Page, request } from '@playwright/test';
import { DEFAULT_ADMIN_USER } from '../constant/user';
import { AdminClass } from '../support/user/AdminClass';
import { getAuthContext, getToken, redirectToHomePage } from './common';

export const authenticateAdminPage = async (page: Page) => {
  await page.goto('/');
  await page.waitForURL((url) => {
    return (
      url.pathname.includes('/my-data') || url.pathname.includes('/signin')
    );
  });

  if (page.url().includes('/signin')) {
    const admin = new AdminClass();
    await admin.login(page);
  }

  await redirectToHomePage(page);
};

export const createAdminApiContext = async (): Promise<{
  apiContext: APIRequestContext;
  afterAction: () => Promise<void>;
}> => {
  const loginContext = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:8585',
    timeout: 90000,
  });

  try {
    const loginResponse = await loginContext.post('/api/v1/auth/login', {
      data: {
        email: DEFAULT_ADMIN_USER.userName,
        password: Buffer.from(DEFAULT_ADMIN_USER.password).toString('base64'),
      },
    });

    if (!loginResponse.ok()) {
      throw new Error(
        `Admin authentication failed (${loginResponse.status()}): ${await loginResponse.text()}`
      );
    }

    const loginPayload = (await loginResponse.json()) as {
      accessToken: string;
    };
    const apiContext = await getAuthContext(loginPayload.accessToken);

    return {
      apiContext,
      afterAction: async () => {
        await apiContext.dispose();
        await loginContext.dispose();
      },
    };
  } catch (error) {
    await loginContext.dispose();

    throw error;
  }
};

export const performAdminLogin = async (browser: Browser) => {
  const admin = new AdminClass();
  const page = await browser.newPage();
  await admin.login(page);
  await redirectToHomePage(page);

  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
  };

  return { page, apiContext, afterAction };
};
