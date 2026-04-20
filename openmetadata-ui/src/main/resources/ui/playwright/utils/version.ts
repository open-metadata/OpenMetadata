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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  you may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect, Page } from '@playwright/test';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { waitForAllLoadersToDisappear } from './entity';

const ENTITY_ROUTE_PATHS: Partial<Record<EntityTypeEndpoint, string>> = {
  [EntityTypeEndpoint.API_COLLECTION]: 'apiCollection',
  [EntityTypeEndpoint.API_ENDPOINT]: 'apiEndpoint',
  [EntityTypeEndpoint.Chart]: 'chart',
  [EntityTypeEndpoint.Container]: 'container',
  [EntityTypeEndpoint.DATA_PRODUCT]: 'dataProduct',
  [EntityTypeEndpoint.Dashboard]: 'dashboard',
  [EntityTypeEndpoint.DataModel]: 'dashboardDataModel',
  [EntityTypeEndpoint.Database]: 'database',
  [EntityTypeEndpoint.DatabaseSchema]: 'databaseSchema',
  [EntityTypeEndpoint.Directory]: 'directory',
  [EntityTypeEndpoint.File]: 'file',
  [EntityTypeEndpoint.Glossary]: 'glossary',
  [EntityTypeEndpoint.GlossaryTerm]: 'glossaryTerm',
  [EntityTypeEndpoint.METRIC]: 'metric',
  [EntityTypeEndpoint.MlModel]: 'mlmodel',
  [EntityTypeEndpoint.Pipeline]: 'pipeline',
  [EntityTypeEndpoint.SearchIndex]: 'searchIndex',
  [EntityTypeEndpoint.Spreadsheet]: 'spreadsheet',
  [EntityTypeEndpoint.StoreProcedure]: 'storedProcedure',
  [EntityTypeEndpoint.Table]: 'table',
  [EntityTypeEndpoint.Topic]: 'topic',
  [EntityTypeEndpoint.Worksheet]: 'worksheet',
};

const getEntityRoute = (
  endpoint: EntityTypeEndpoint,
  fullyQualifiedName: string
) => {
  if (endpoint.startsWith('services/')) {
    return `/service/${endpoint.replace('services/', '')}/${encodeURIComponent(
      fullyQualifiedName
    )}`;
  }

  const routePath = ENTITY_ROUTE_PATHS[endpoint];

  if (!routePath) {
    throw new Error(`No direct route mapping found for endpoint: ${endpoint}`);
  }

  return `/${routePath}/${encodeURIComponent(fullyQualifiedName)}`;
};

export const visitVersionedEntityPage = async (
  page: Page,
  endpoint: EntityTypeEndpoint,
  fullyQualifiedName: string
) => {
  await page.goto(getEntityRoute(endpoint, fullyQualifiedName));
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('version-button')).toBeVisible({
    timeout: 30000,
  });
};

export const openEntityVersion = async (page: Page, version: string) => {
  await expect
    .poll(
      async () => {
        const versionButton = page.getByTestId('version-button');
        const buttonText =
          (await versionButton.textContent().catch(() => '')) ?? '';

        if (buttonText.includes(version)) {
          return buttonText;
        }

        await page.reload();
        await waitForAllLoadersToDisappear(page);

        return (await versionButton.textContent().catch(() => '')) ?? '';
      },
      {
        timeout: 30000,
        intervals: [1000, 2000, 5000],
      }
    )
    .toContain(version);

  const versionDetailResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/versions/${version}`) &&
      response.status() === 200
  );
  await page.getByTestId('version-button').click();
  await versionDetailResponse;
};
