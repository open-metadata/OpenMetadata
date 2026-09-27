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

/**
 * The Data Observability tab on a tag / glossary term / domain aggregates test cases by that
 * entity's FQN. The aggregation reads the governance entity's own search doc, so rebuilding it
 * is what would surface a dropped field: the tab keeps rendering from live-written state and
 * only goes blank once the doc has actually been through reindex.
 *
 * DataObservabilityGovernanceTab.spec.ts covers these tabs against live-written docs; this
 * covers them after a rebuild. Ported from the deleted {Tag,GlossaryTerm,Domain}
 * DataObservabilityReindexUIIT and TagDataObservabilityFlowsReindexUIIT.
 */

import { Page } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { createNewPage } from '../../../utils/common';
import {
  DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID,
  ENTITY_HEALTH_PIE_CHART_TEST_ID,
  TEST_CASE_STATUS_PIE_CHART_TEST_ID,
} from '../../../utils/dataQuality';
import { getCurrentMillis } from '../../../utils/dateTime';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { reindexEntities, ReindexTarget } from '../../../utils/reindex';

test.use({ storageState: 'playwright/.auth/admin.json' });

const WIDGET_TIMEOUT = 15_000;

let classification: ClassificationClass;
let tag: TagClass;
let glossary: Glossary;
let glossaryTerm: GlossaryTerm;
let domain: Domain;
let table: TableClass;

const targetFor = (
  type: string,
  responseData: { id: string; fullyQualifiedName: string }
): ReindexTarget => ({
  id: responseData.id,
  type,
  fullyQualifiedName: responseData.fullyQualifiedName,
});

test.beforeAll('setup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  classification = new ClassificationClass();
  tag = new TagClass({ classification: classification.data.name });
  glossary = new Glossary();
  glossaryTerm = new GlossaryTerm(glossary);
  domain = new Domain();
  table = new TableClass();

  await classification.create(apiContext);
  await tag.create(apiContext);
  await glossary.create(apiContext);
  await glossaryTerm.create(apiContext);
  await domain.create(apiContext);
  await table.create(apiContext);

  await table.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          name: tag.data.name,
          tagFQN: tag.responseData.fullyQualifiedName,
          labelType: 'Manual',
          state: 'Confirmed',
        },
      },
      {
        op: 'add',
        path: '/tags/1',
        value: {
          name: glossaryTerm.data.name,
          tagFQN: glossaryTerm.responseData.fullyQualifiedName,
          labelType: 'Manual',
          state: 'Confirmed',
          source: 'Glossary',
        },
      },
      {
        op: 'add',
        path: '/domains',
        value: [
          {
            id: domain.responseData.id,
            type: 'domain',
            name: domain.responseData.name,
            displayName: domain.responseData.displayName,
          },
        ],
      },
    ],
  });

  const testCase = await table.createTestCase(apiContext);
  await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
    result: 'Found value outside expected range.',
    testResultValue: [{ name: 'value', value: '5' }],
    timestamp: getCurrentMillis(),
    testCaseStatus: 'Failed' as const,
  });

  await afterAction();
});

test.afterAll('cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await table.delete(apiContext);
  await domain.delete(apiContext);
  await glossaryTerm.delete(apiContext);
  await glossary.delete(apiContext);
  await tag.delete(apiContext);
  await classification.delete(apiContext);

  await afterAction();
});

const expectDashboardWidgets = async (page: Page) => {
  await expect(
    page.locator(`#${TEST_CASE_STATUS_PIE_CHART_TEST_ID}`)
  ).toBeVisible({ timeout: WIDGET_TIMEOUT });
  await expect(page.locator(`#${ENTITY_HEALTH_PIE_CHART_TEST_ID}`)).toBeVisible(
    {
      timeout: WIDGET_TIMEOUT,
    }
  );
  await expect(
    page.locator(`#${DATA_ASSETS_COVERAGE_PIE_CHART_TEST_ID}`)
  ).toBeVisible({ timeout: WIDGET_TIMEOUT });
};

test('Tag Data Observability tab still loads after the tag is reindexed', async ({
  page,
  browser,
}) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await reindexEntities(apiContext, [targetFor('tag', tag.responseData)]);
  await afterAction();

  await page.goto(
    `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}`
  );
  await waitForAllLoadersToDisappear(page);

  await page.getByRole('tab', { name: /data observability/i }).click();
  await waitForAllLoadersToDisappear(page);

  await expectDashboardWidgets(page);

  // The pre-applied tag filter is what scopes the dashboard to this tag; if the rebuilt doc
  // lost the FQN the chip disappears and the tab silently shows unfiltered results.
  await expect(
    page.getByTestId('search-dropdown-Tag'),
    'pre-applied tag filter must stay hidden on the tag Data Observability tab'
  ).not.toBeVisible();
  await expect(page.getByTestId('search-dropdown-owner')).toBeVisible();
});

test('GlossaryTerm Data Observability tab still loads after the term is reindexed', async ({
  page,
  browser,
}) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await reindexEntities(apiContext, [
    targetFor('glossaryTerm', glossaryTerm.responseData),
  ]);
  await afterAction();

  await page.goto(
    `/glossary/${encodeURIComponent(
      glossaryTerm.responseData.fullyQualifiedName
    )}`
  );
  await waitForAllLoadersToDisappear(page);

  await page.getByRole('tab', { name: /data observability/i }).click();
  await waitForAllLoadersToDisappear(page);

  await expectDashboardWidgets(page);
});

test('Domain Data Observability tab still loads after the domain is reindexed', async ({
  page,
  browser,
}) => {
  test.slow();

  const { apiContext, afterAction } = await createNewPage(browser);
  await reindexEntities(apiContext, [targetFor('domain', domain.responseData)]);
  await afterAction();

  const domainFqn = domain.responseData.fullyQualifiedName ?? domain.data.name;
  await page.goto(`/domain/${encodeURIComponent(domainFqn)}`);
  await waitForAllLoadersToDisappear(page);

  await page.getByRole('tab', { name: /data observability/i }).click();
  await waitForAllLoadersToDisappear(page);

  await expectDashboardWidgets(page);
});
