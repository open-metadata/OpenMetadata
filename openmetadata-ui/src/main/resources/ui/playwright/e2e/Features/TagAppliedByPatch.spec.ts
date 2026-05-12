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

import { expect, test } from '@playwright/test';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { assignGlossaryTerm } from '../../utils/entity';

const table = new TableClass();
const glossaryTerm = new GlossaryTerm();

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await glossaryTerm.create(apiContext);
  await glossaryTerm.patch(apiContext, [
    {
      op: 'add',
      path: '/tags',
      value: [
        {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
    },
  ]);

  await table.create(apiContext);

  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await glossaryTerm.glossary.delete(apiContext);
  await afterAction();
});

test('Inherited tags from a glossary term carry appliedBy after the PATCH that attaches the term (#28038)', async ({
  page,
}) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/tables/') &&
      response.request().method() === 'PATCH'
  );

  await assignGlossaryTerm(
    page,
    {
      displayName: glossaryTerm.data.displayName,
      name: glossaryTerm.data.name,
      fullyQualifiedName: glossaryTerm.responseData.fullyQualifiedName,
    },
    'Add',
    'tables'
  );

  const response = await patchResponse;
  expect(response.status()).toBe(200);

  const body = await response.json();
  const tags = body.tags ?? [];
  expect(tags.length).toBeGreaterThan(1);

  const derived = tags.find(
    (tag: { labelType?: string }) => tag.labelType === 'Derived'
  );
  expect(derived).toBeDefined();
  expect(derived.appliedBy).toBeDefined();

  await expect(
    page
      .getByTestId('KnowledgePanel.Tags')
      .getByTestId('tags-container')
      .getByTestId('tag-PII.Sensitive')
  ).toBeVisible();
});
