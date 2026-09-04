/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { expect, Page, Response } from '@playwright/test';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';

// Playwright does not import application routing code outside generated types and enums.
const AI_CONTEXT_LIST_ROUTE = '/context-center/ai-context';

export const enablePersonaRulePreloading = async (
  page: Page
): Promise<void> => {
  const filteredInSearch = page
    .getByTestId('context-rule-filtered-in-search')
    .getByRole('switch');

  await expect(filteredInSearch).toBeChecked();
  await expect(filteredInSearch).toBeEnabled();
  // The sticky drawer footer can overlap the switch after scrolling, so use its
  // accessible keyboard interaction instead of relying on a pointer hit target.
  await filteredInSearch.press('Space');
  await expect(filteredInSearch).not.toBeChecked();
};

/** Opens a persona's AI context through its supported Context Center entry point. */
export const openPersonaAIContext = async (
  page: Page,
  personaName: string
): Promise<Response> => {
  await redirectToHomePage(page);
  await page.goto(AI_CONTEXT_LIST_ROUTE, {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId('context-center-ai-context-page')
  ).toBeVisible();
  const personaCard = page.getByTestId(`ai-context-persona-${personaName}`);
  await expect(personaCard).toBeVisible();

  const configurationResponse = page.waitForResponse(
    (response) =>
      /\/api\/v1\/personas\/[^/]+\/aiContext$/.test(
        new URL(response.url()).pathname
      ) && response.request().method() === 'GET'
  );
  await personaCard.click();
  const response = await configurationResponse;

  await waitForAllLoadersToDisappear(page);
  await expect(
    page.getByTestId('context-center-ai-context-detail-page')
  ).toBeVisible();
  await expect(page.getByTestId('persona-ai-context')).toBeVisible();

  return response;
};
