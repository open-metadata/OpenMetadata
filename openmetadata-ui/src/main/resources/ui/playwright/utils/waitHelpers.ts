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

import { Locator, Page, Response } from '@playwright/test';

/**
 * Registers the response listener *before* triggering the click, which is the
 * only ordering that cannot race: a response fired between the click and a
 * later `waitForResponse` is unobservable and the wait hangs until timeout.
 */
export const clickAndWaitFor = async (
  page: Page,
  locator: Locator,
  urlPattern: string | RegExp,
  expectedStatus = 200
): Promise<Response> => {
  const responsePromise = page.waitForResponse(urlPattern);
  await locator.click();
  const response = await responsePromise;

  if (response.status() !== expectedStatus) {
    throw new Error(
      `Expected ${String(urlPattern)} to return ${expectedStatus}, got ${response.status()}`
    );
  }

  return response;
};
