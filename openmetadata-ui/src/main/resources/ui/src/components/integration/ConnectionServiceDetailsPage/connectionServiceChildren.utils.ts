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
import { File } from '../../../generated/entity/data/file';
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
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

export type ServiceTabCounts = Partial<Record<EntityTabs, number>>;

// `root` matches the lists those tabs render, so a badge never counts rows its tab cannot show.
const countRootDriveAssets = async (
  entityType: EntityType.FILE | EntityType.SPREADSHEET,
  service: string,
  include: Include
) => {
  const { paging } = await getDriveAssets<File | Spreadsheet>(entityType, {
    service,
    root: true,
    include,
    paging: { limit: 0 },
  });

  return paging.total;
};

/** Badge counts for the tabs a category lists beside its data assets; empty for a category with none. */
export const fetchServiceTabCounts = async (
  serviceCategory: ServiceCategory,
  service: string,
  include: Include
): Promise<ServiceTabCounts> => {
  if (serviceCategory === ServiceCategory.DASHBOARD_SERVICES) {
    const { paging } = await getDataModels({ service, include, limit: 0 });

    return { [EntityTabs.DATA_Model]: paging.total };
  }

  if (serviceCategory === ServiceCategory.DRIVE_SERVICES) {
    const [files, spreadsheets] = await Promise.all([
      countRootDriveAssets(EntityType.FILE, service, include),
      countRootDriveAssets(EntityType.SPREADSHEET, service, include),
    ]);

    return {
      [EntityTabs.FILES]: files,
      [EntityTabs.SPREADSHEETS]: spreadsheets,
    };
  }

  return {};
};
