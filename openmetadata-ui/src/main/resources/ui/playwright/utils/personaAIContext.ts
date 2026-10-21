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
import { expect, Locator, Page, Response } from '@playwright/test';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';

// Playwright does not import application routing code outside generated types and enums.
const AI_CONTEXT_LIST_ROUTE = '/context-center/ai-context';
const MAX_LIST_PAGES = 50;

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

const isPersonaListResponse = (response: Response) =>
  new URL(response.url()).pathname === '/api/v1/personas' &&
  response.request().method() === 'GET';

/**
 * Opens the AI Context persona table and returns the persona's row, paging forward until it is
 * on screen — the table is cursor-paginated by name, so a test persona can land past page one.
 */
export const findPersonaAIContextRow = async (
  page: Page,
  personaName: string
): Promise<Locator> => {
  await redirectToHomePage(page);
  const firstPage = page.waitForResponse(isPersonaListResponse);
  await page.goto(AI_CONTEXT_LIST_ROUTE, {
    waitUntil: 'domcontentloaded',
  });
  await firstPage;
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId('context-center-ai-context-page')
  ).toBeVisible();
  await expect(page.getByTestId('ai-context-persona-table')).toBeVisible();

  const row = page.getByTestId(`ai-context-persona-${personaName}`);
  const nextPage = page.getByTestId('next');
  // Bounded so a persona that never appears fails here instead of spinning.
  for (let pageIndex = 0; pageIndex < MAX_LIST_PAGES; pageIndex++) {
    if ((await row.count()) > 0 || !(await nextPage.isEnabled())) {
      break;
    }
    const nextResponse = page.waitForResponse(isPersonaListResponse);
    await nextPage.click();
    await nextResponse;
    await waitForAllLoadersToDisappear(page);
  }
  await expect(row).toBeVisible();

  return row;
};

/** Opens a persona's AI context through its supported Context Center entry point. */
export const openPersonaAIContext = async (
  page: Page,
  personaName: string
): Promise<Response> => {
  const personaRow = await findPersonaAIContextRow(page, personaName);

  const configurationResponse = page.waitForResponse(
    (response) =>
      /\/api\/v1\/personas\/[^/]+\/aiContext$/.test(
        new URL(response.url()).pathname
      ) && response.request().method() === 'GET'
  );
  await personaRow.getByTestId('ai-context-persona-rules').click();
  const response = await configurationResponse;

  await waitForAllLoadersToDisappear(page);
  await expect(
    page.getByTestId('context-center-ai-context-detail-page')
  ).toBeVisible();
  await expect(page.getByTestId('persona-ai-context')).toBeVisible();

  return response;
};
