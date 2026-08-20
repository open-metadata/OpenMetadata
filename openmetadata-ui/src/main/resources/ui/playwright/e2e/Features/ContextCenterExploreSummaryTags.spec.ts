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

import { expect } from '@playwright/test';
import { KnowledgeCenterClass } from '../../support/entity/KnowledgeCenterClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForSearchIndexed } from '../../utils/polling';
import { test } from '../fixtures/pages';
import { navigateToKCEntity } from '../Utils/ExplorePageRightPanelUtils';

// Regression: a Context Center article's tags must show in the Explore
// right-side summary panel. getEntityByFqnUtil used to drop the `fields`
// argument for the page entity, so the panel fetched the article without
// `fields=tags` and always rendered "No Tags". See EntityByFqnUtils.ts.
const classification = new ClassificationClass();
const tag = new TagClass({ classification: classification.data.name });
const article = new KnowledgeCenterClass();

test.describe('Context Center article tags in Explore summary panel', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await classification.create(apiContext);
    await tag.create(apiContext);
    await article.create(apiContext);
    await article.patch(apiContext, [
      {
        op: 'add',
        path: '/tags',
        value: [
          {
            tagFQN: tag.responseData.fullyQualifiedName,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
      },
    ]);
    await waitForSearchIndexed(
      apiContext,
      article.responseData.fullyQualifiedName,
      'knowledge_page_search_index'
    );
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await article.delete(apiContext);
    await tag.delete(apiContext);
    await classification.delete(apiContext);
    await afterAction();
  });

  test('shows the article tags in the summary panel', async ({ page }) => {
    await redirectToHomePage(page);
    await navigateToKCEntity(page, article.responseData.displayName);

    const summaryPanel = page.getByTestId('entity-summary-panel-container');

    await expect(
      summaryPanel.getByText(tag.responseData.displayName)
    ).toBeVisible();
  });
});
