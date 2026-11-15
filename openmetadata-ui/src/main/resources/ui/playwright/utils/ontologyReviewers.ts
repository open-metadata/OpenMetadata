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
import { expect, Page, Response } from '@playwright/test';
import { openOwnerPicker } from './entity';

/**
 * Picks a user in the Review & publish reviewer card's shared user/team picker and
 * applies it, resolving with the settings PATCH it triggers.
 */
export const addOntologyReviewer = async (
  page: Page,
  ontologyId: string,
  name: string,
  displayName = name
): Promise<Response> => {
  const card = page.getByTestId('ontology-release-reviewers');
  await openOwnerPicker(
    page,
    card.getByTestId('ontology-release-add-reviewer')
  );
  const tabs = page.getByTestId('select-owner-tabs');
  await tabs.getByRole('tab', { name: 'Users' }).click();
  const panel = tabs.getByTestId('owner-select-users-panel');
  const search = panel.getByTestId('owner-select-users-search-bar');
  const option = panel.getByTestId('owner-option').filter({
    hasText: displayName,
  });
  await expect(async () => {
    await search.fill('');
    await search.fill(name);
    await expect(option).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await option.click();
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/ontologies/${ontologyId}` &&
      response.request().method() === 'PATCH'
  );
  await panel.getByTestId('selectable-list-update-btn').click();
  const response = await saved;
  expect(response.status()).toBe(200);
  await expect(
    card.getByRole('listitem').filter({ hasText: displayName })
  ).toBeVisible();

  return response;
};
