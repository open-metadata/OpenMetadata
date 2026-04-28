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

import { APIRequestContext, Browser, expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { getAuthContext, getToken, redirectToHomePage } from '../utils/common';
import { sidebarClick } from '../utils/sidebar';

export async function applyGlossaryFilter(page: Page, glossaryId: string) {
  await page.getByTestId('search-dropdown-Glossary').click();
  await page.getByTestId(glossaryId).click();
  await page.getByTestId('update-btn').click();
}

export async function navigateToOntologyExplorer(page: Page) {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries*');
  await sidebarClick(page, SidebarItem.ONTOLOGY_EXPLORER);
  await glossaryResponse;
}

export async function waitForGraphLoaded(page: Page) {
  await expect(page.getByTestId('ontology-graph-loading')).not.toBeVisible({
    timeout: 30000,
  });
}

export async function readNodePositions(
  page: Page
): Promise<Record<string, { x: number; y: number }>> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>('.ontology-g6-container');
      const pos = el?.dataset.nodePositions;
      if (!pos) {
        return false;
      }
      try {
        return Object.keys(JSON.parse(pos)).length > 0;
      } catch {
        return false;
      }
    },
    { timeout: 20000 }
  );

  return page
    .locator('.ontology-g6-container')
    .evaluate(
      (el: HTMLElement) =>
        JSON.parse(el.dataset.nodePositions ?? '{}') as Record<
          string,
          { x: number; y: number }
        >
    );
}

export async function clickFirstGraphNode(page: Page): Promise<void> {
  const positions = await readNodePositions(page);
  const firstPos = Object.values(positions)[0];
  await page.mouse.click(firstPos.x, firstPos.y);
}

export async function createApiContext(browser: Browser) {
  const page = await browser.newPage({
    storageState: 'playwright/.auth/admin.json',
  });
  await redirectToHomePage(page);
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);

  return { page, apiContext };
}

export async function disposeApiContext(
  page: Page,
  apiContext: APIRequestContext
) {
  await apiContext.dispose();
  await page.close();
}

export async function deleteEntities(
  apiContext: APIRequestContext,
  ...entities: Array<Glossary | GlossaryTerm>
) {
  for (const entity of entities) {
    if (entity.responseData?.id) {
      await entity.delete(apiContext);
    }
  }
}

export async function addTermRelation(
  apiContext: APIRequestContext,
  fromTerm: GlossaryTerm,
  toTerm: GlossaryTerm,
  relationType: string
) {
  await fromTerm.patch(apiContext, [
    {
      op: 'add',
      path: '/relatedTerms/0',
      value: {
        relationType,
        term: {
          id: toTerm.responseData.id,
          type: 'glossaryTerm',
          name: toTerm.responseData.name,
          displayName: toTerm.responseData.displayName,
          fullyQualifiedName: toTerm.responseData.fullyQualifiedName,
        },
      },
    },
  ]);
}

export async function navigateAndFilterByGlossary(
  page: Page,
  glossaryId: string
) {
  await navigateToOntologyExplorer(page);
  await waitForGraphLoaded(page);
  await applyGlossaryFilter(page, glossaryId);
  await waitForGraphLoaded(page);
}

export async function applyRelationTypeFilter(page: Page, typeName: string) {
  await page.getByTestId('search-dropdown-Relationship Type').click();
  await page.getByTestId('drop-down-menu').getByText(typeName).click();
  await page.getByTestId('update-btn').click();
  await waitForGraphLoaded(page);
}
