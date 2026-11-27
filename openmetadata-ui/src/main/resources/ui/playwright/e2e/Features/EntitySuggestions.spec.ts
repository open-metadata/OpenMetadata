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
import { APIRequestContext, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { DataProduct } from '../../support/domain/DataProduct';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { pickEntityMatrix } from '../../utils/entityMatrix';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { expect, test } from '../fixtures/pages';

interface SuggestionTarget {
  create: (apiContext: APIRequestContext) => Promise<unknown>;
  delete: (apiContext: APIRequestContext) => Promise<unknown>;
  visitEntityPage: (page: Page) => Promise<void>;
}

type TargetCase = {
  entityType: string;
  build: () => { target: SuggestionTarget; getFqn: () => string };
};

const fromEntityClass = <
  T extends SuggestionTarget & {
    entityResponseData: { fullyQualifiedName?: string };
  }
>(
  target: T
) => ({
  target,
  getFqn: () => target.entityResponseData.fullyQualifiedName ?? '',
});

// Each case mounts its detail page through a different provider path: the
// shared entity router, the glossary route, or a page outside React Query.
const TARGETS: TargetCase[] = [
  { entityType: 'table', build: () => fromEntityClass(new TableClass()) },
  { entityType: 'topic', build: () => fromEntityClass(new TopicClass()) },
  {
    entityType: 'dashboard',
    build: () => fromEntityClass(new DashboardClass()),
  },
  { entityType: 'pipeline', build: () => fromEntityClass(new PipelineClass()) },
  { entityType: 'mlmodel', build: () => fromEntityClass(new MlModelClass()) },
  {
    entityType: 'container',
    build: () => fromEntityClass(new ContainerClass()),
  },
  {
    entityType: 'searchIndex',
    build: () => fromEntityClass(new SearchIndexClass()),
  },
  {
    entityType: 'apiEndpoint',
    build: () => fromEntityClass(new ApiEndpointClass()),
  },
  { entityType: 'metric', build: () => fromEntityClass(new MetricClass()) },
  { entityType: 'chart', build: () => fromEntityClass(new ChartClass()) },
  {
    entityType: 'dashboardDataModel',
    build: () => fromEntityClass(new DashboardDataModelClass()),
  },
  {
    entityType: 'apiCollection',
    build: () => fromEntityClass(new ApiCollectionClass()),
  },
  { entityType: 'database', build: () => fromEntityClass(new DatabaseClass()) },
  {
    entityType: 'databaseSchema',
    build: () => fromEntityClass(new DatabaseSchemaClass()),
  },
  {
    entityType: 'storedProcedure',
    build: () => fromEntityClass(new StoredProcedureClass()),
  },
  {
    entityType: 'directory',
    build: () => fromEntityClass(new DirectoryClass()),
  },
  { entityType: 'file', build: () => fromEntityClass(new FileClass()) },
  {
    entityType: 'spreadsheet',
    build: () => fromEntityClass(new SpreadsheetClass()),
  },
  {
    entityType: 'worksheet',
    build: () => fromEntityClass(new WorksheetClass()),
  },
  {
    entityType: 'dataProduct',
    build: () => {
      const dataProduct = new DataProduct();

      return {
        target: dataProduct,
        getFqn: () => dataProduct.responseData.fullyQualifiedName ?? '',
      };
    },
  },
  {
    entityType: 'glossaryTerm',
    build: () => {
      const glossaryTerm = new GlossaryTerm();

      return {
        target: {
          create: (apiContext) => glossaryTerm.create(apiContext),
          delete: async (apiContext) => {
            await glossaryTerm.delete(apiContext);
            await glossaryTerm.glossary.delete(apiContext);
          },
          visitEntityPage: (page) => glossaryTerm.visitEntityPage(page),
        },
        getFqn: () => glossaryTerm.responseData.fullyQualifiedName ?? '',
      };
    },
  },
];

test.describe(
  'Entity description suggestions',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    // PR/merge-queue CI runs one representative entity; nightly and local runs
    // cover every entity. Metric exercises the router-level provider and the
    // React Query refresh, which is the path most entity pages take.
    for (const { entityType, build } of pickEntityMatrix(
      __filename,
      TARGETS,
      TARGETS.filter(({ entityType }) => entityType === 'metric')
    )) {
      test(`accepting a description suggestion on ${entityType} updates the page without a reload`, async ({
        page,
      }) => {
        test.slow();

        const { target, getFqn } = build();
        const suggestedDescription = `Suggested ${entityType} description ${uuid()}`;
        await redirectToHomePage(page);
        const { apiContext, afterAction } = await getApiContext(page);
        let taskId: string | undefined;

        try {
          await test.step('Create the entity and its suggestion', async () => {
            await target.create(apiContext);

            const response = await apiContext.post('/api/v1/tasks', {
              data: {
                about: `<#E::${entityType}::${getFqn()}>`,
                type: 'Suggestion',
                category: 'MetadataUpdate',
                payload: {
                  source: 'Agent',
                  suggestionType: 'Description',
                  fieldPath: 'description',
                  suggestedValue: suggestedDescription,
                },
              },
            });

            expect(response.ok()).toBe(true);

            taskId = (await response.json()).id;
          });

          await test.step('Open the suggestion on the entity page', async () => {
            const suggestionsResponse = waitForResponseWithStatus(
              page,
              (response) =>
                response.url().includes('/api/v1/tasks') &&
                response.url().includes('type=Suggestion'),
              200
            );
            await target.visitEntityPage(page);
            await suggestionsResponse;
            await waitForAllLoadersToDisappear(page);

            await page.getByTestId(/^avatar-carousel-item-/).click();

            await expect(
              page.getByTestId('suggested-SuggestDescription-card')
            ).toBeVisible();
          });

          await test.step('Accept it and see the description applied', async () => {
            const acceptResponse = waitForResponseWithStatus(
              page,
              (response) =>
                response.url().includes(`/api/v1/tasks/${taskId}`) &&
                response.request().method() !== 'GET',
              200
            );
            await page.getByTestId('accept-suggestion').click();
            await acceptResponse;

            await expect(
              page.getByTestId('suggested-SuggestDescription-card')
            ).not.toBeVisible();
            await expect(
              page.getByTestId('asset-description-container')
            ).toContainText(suggestedDescription);
          });
        } finally {
          if (taskId) {
            await apiContext
              .delete(`/api/v1/tasks/${taskId}?hardDelete=true`)
              .catch(() => undefined);
          }
          await target.delete(apiContext);
          await afterAction();
        }
      });
    }
  }
);
