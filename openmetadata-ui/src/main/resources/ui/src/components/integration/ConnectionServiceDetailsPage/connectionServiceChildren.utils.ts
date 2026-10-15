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
import { PagingResponse, PagingWithoutTotal } from 'Models';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Directory } from '../../../generated/entity/data/directory';
import { Include } from '../../../generated/type/include';
import { ServicePageData } from '../../../interface/platform/service.interface';
import { getApiCollections } from '../../../rest/apiCollectionsAPI';
import { getDashboards, getDataModels } from '../../../rest/dashboardAPI';
import { getDatabases } from '../../../rest/databaseAPI';
import { getDriveAssets } from '../../../rest/driveAPI';
import { getMlModels } from '../../../rest/mlModelAPI';
import { getPipelines } from '../../../rest/pipelineAPI';
import { getSearchIndexes } from '../../../rest/SearchIndexAPI';
import { getContainers } from '../../../rest/storageAPI';
import { getTopics } from '../../../rest/topicsAPI';

export interface ServiceChildrenParams {
  service: string;
  fields: string;
  paging: PagingWithoutTotal;
  include: Include;
}

type ServiceChildrenFetcher = (
  params: ServiceChildrenParams
) => Promise<PagingResponse<ServicePageData[]>>;

// Containers, search indexes and directories nest; `root` keeps the list to the top level, as
// classic service details does. A Map, not an object literal: the category comes from the URL, and
// an object would also answer inherited keys such as `constructor`.
const SERVICE_CHILDREN_FETCHERS = new Map<
  ServiceCategory,
  ServiceChildrenFetcher
>([
  [
    ServiceCategory.DATABASE_SERVICES,
    ({ service, fields, paging, include }) =>
      getDatabases(service, fields, paging, include),
  ],
  [
    ServiceCategory.MESSAGING_SERVICES,
    ({ service, fields, paging, include }) =>
      getTopics(service, fields, paging, include),
  ],
  [
    ServiceCategory.DASHBOARD_SERVICES,
    ({ service, fields, paging, include }) =>
      getDashboards(service, fields, paging, include),
  ],
  [
    ServiceCategory.PIPELINE_SERVICES,
    ({ service, fields, paging, include }) =>
      getPipelines(service, fields, paging, include),
  ],
  [
    ServiceCategory.ML_MODEL_SERVICES,
    ({ service, fields, paging, include }) =>
      getMlModels(service, fields, paging, include),
  ],
  [
    ServiceCategory.STORAGE_SERVICES,
    (params) => getContainers({ ...params, root: true }),
  ],
  [
    ServiceCategory.SEARCH_SERVICES,
    (params) => getSearchIndexes({ ...params, root: true }),
  ],
  [ServiceCategory.API_SERVICES, getApiCollections],
  [
    ServiceCategory.DRIVE_SERVICES,
    (params) =>
      getDriveAssets<Directory>(EntityType.DIRECTORY, {
        ...params,
        root: true,
      }),
  ],
]);

/** Top-level child assets of a service; `undefined` for a category that lists none. */
export const fetchServiceChildren = (
  serviceCategory: ServiceCategory,
  params: ServiceChildrenParams
): Promise<PagingResponse<ServicePageData[]>> | undefined => {
  const fetcher = SERVICE_CHILDREN_FETCHERS.get(serviceCategory);

  // The category is read from the URL, so call only a fetcher the table actually holds.
  return typeof fetcher === 'function' ? fetcher(params) : undefined;
};

// `limit: 0` returns no rows, only the total.
const COUNT_PAGING = { limit: 0 };

/** How many top-level child assets a service has; `undefined` for a category that lists none. */
export const countServiceChildren = async (
  serviceCategory: ServiceCategory,
  service: string,
  include: Include
): Promise<number | undefined> => {
  const response = await fetchServiceChildren(serviceCategory, {
    service,
    fields: '',
    paging: COUNT_PAGING,
    include,
  });

  return response?.paging.total;
};

export interface SecondaryAssetTab {
  key: EntityTabs;
  labelKey: string;
  countAssets: (service: string, include: Include) => Promise<number>;
}

const countDriveAssets = async (
  entityType: EntityType.FILE | EntityType.SPREADSHEET,
  service: string,
  include: Include
) => {
  const response = await getDriveAssets(entityType, {
    service,
    root: true,
    paging: COUNT_PAGING,
    include,
  });

  return response.paging.total;
};

// The asset tabs classic shows beside the main one, for the categories that have them. They sit
// between the data-assets tab and Connection, in this order. A Map for the same reason as the
// fetchers above.
const SECONDARY_ASSET_TABS = new Map<ServiceCategory, SecondaryAssetTab[]>([
  [
    ServiceCategory.DASHBOARD_SERVICES,
    [
      {
        key: EntityTabs.DATA_Model,
        labelKey: 'label.data-model',
        countAssets: async (service, include) => {
          const response = await getDataModels({ service, include, limit: 0 });

          return response.paging.total;
        },
      },
    ],
  ],
  [
    ServiceCategory.DRIVE_SERVICES,
    [
      {
        key: EntityTabs.FILES,
        labelKey: 'label.file-plural',
        countAssets: (service, include) =>
          countDriveAssets(EntityType.FILE, service, include),
      },
      {
        key: EntityTabs.SPREADSHEETS,
        labelKey: 'label.spreadsheet-plural',
        countAssets: (service, include) =>
          countDriveAssets(EntityType.SPREADSHEET, service, include),
      },
    ],
  ],
]);

const NO_SECONDARY_TABS: SecondaryAssetTab[] = [];

export const getSecondaryAssetTabs = (
  serviceCategory: ServiceCategory
): SecondaryAssetTab[] =>
  SECONDARY_ASSET_TABS.get(serviceCategory) ?? NO_SECONDARY_TABS;
