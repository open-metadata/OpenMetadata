/*
 *  Copyright 2025 Collate.
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
import { AssetReference, DataProduct } from '../support/domain/DataProduct';
import { Domain } from '../support/domain/Domain';
import { DashboardClass } from '../support/entity/DashboardClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import {
  DrawerQuickFilterContext,
  toDrawerAsset,
} from './assetDrawerQuickFilter';
import { waitForAllLoadersToDisappear } from './entity';

type PortAssetType = 'table' | 'topic' | 'dashboard';

export interface SeededFilterAssets {
  dataProduct: DataProduct;
  tieredTable: TableClass;
  plainTable: TableClass;
  filterTopic: TopicClass;
  filterDashboard: DashboardClass;
}

export const createAssetRef = (
  entity: TableClass | TopicClass | DashboardClass,
  type: PortAssetType
): AssetReference => ({
  id: entity.entityResponseData.id,
  type,
  name: entity.entityResponseData.name,
  displayName: entity.entityResponseData.displayName,
  fullyQualifiedName: entity.entityResponseData.fullyQualifiedName,
  description: entity.entityResponseData.description,
});

export const seedDrawerFilterAssets = async (
  apiContext: APIRequestContext,
  domain: Domain,
  addToDataProduct: boolean
): Promise<SeededFilterAssets> => {
  const dataProduct = new DataProduct([domain]);
  const tieredTable = new TableClass();
  const plainTable = new TableClass();
  const filterTopic = new TopicClass();
  const filterDashboard = new DashboardClass();

  await dataProduct.create(apiContext);

  const domainPatch = {
    op: 'add' as const,
    path: '/domains/0',
    value: { id: domain.responseData.id, type: 'domain' },
  };

  await tieredTable.create(apiContext);
  await tieredTable.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          tagFQN: 'Tier.Tier1',
          source: 'Classification',
          labelType: 'Manual',
        },
      },
      domainPatch,
    ],
  });
  await plainTable.create(apiContext);
  await plainTable.patch({ apiContext, patchData: [domainPatch] });
  await filterTopic.create(apiContext);
  await filterTopic.patch({ apiContext, patchData: [domainPatch] });
  await filterDashboard.create(apiContext);
  await filterDashboard.patch({ apiContext, patchData: [domainPatch] });

  if (addToDataProduct) {
    await dataProduct.addAssets(apiContext, [
      createAssetRef(tieredTable, 'table'),
      createAssetRef(plainTable, 'table'),
      createAssetRef(filterTopic, 'topic'),
      createAssetRef(filterDashboard, 'dashboard'),
    ]);
  }

  return { dataProduct, tieredTable, plainTable, filterTopic, filterDashboard };
};

export const cleanupDrawerFilterAssets = async (
  apiContext: APIRequestContext,
  seeded: SeededFilterAssets
) => {
  await seeded.dataProduct.delete(apiContext);
  await seeded.tieredTable.delete(apiContext);
  await seeded.plainTable.delete(apiContext);
  await seeded.filterTopic.delete(apiContext);
  await seeded.filterDashboard.delete(apiContext);
};

export const buildPortDrawerContext = (
  page: Page,
  surface: string,
  addButtonTestId: string,
  seeded: SeededFilterAssets
): DrawerQuickFilterContext => ({
  surface,
  openDrawer: async () => {
    await page.getByTestId(addButtonTestId).click();
    await page
      .getByTestId('asset-selection-modal')
      .waitFor({ state: 'visible' });
    await waitForAllLoadersToDisappear(page);
  },
  closeDrawer: async () => {
    await page.getByTestId('cancel-btn').click();
    await page
      .getByTestId('asset-selection-modal')
      .waitFor({ state: 'hidden' });
  },
  table: toDrawerAsset(seeded.tieredTable),
  untieredTable: toDrawerAsset(seeded.plainTable),
  topic: toDrawerAsset(seeded.filterTopic),
  dashboard: toDrawerAsset(seeded.filterDashboard),
});
