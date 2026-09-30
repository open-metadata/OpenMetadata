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
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Directory } from '../../../generated/entity/data/directory';
import { Include } from '../../../generated/type/include';
import { ServicePageData } from '../../../interface/platform/service.interface';
import { getApiCollections } from '../../../rest/apiCollectionsAPI';
import { getDashboards } from '../../../rest/dashboardAPI';
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
): Promise<PagingResponse<ServicePageData[]>> | undefined =>
  SERVICE_CHILDREN_FETCHERS.get(serviceCategory)?.(params);
