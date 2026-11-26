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

import { FC, lazy } from 'react';
import withVersionFallback, {
  TAB_CONTENT_FALLBACK,
} from '../components/AppRouter/withSuspenseFallback';
import { EntityType } from '../enums/entity.enum';
import entityUtilClassBase from './EntityUtilClassBase';

class EntityVersionClassBase {
  protected componentMap = {
    [EntityType.TABLE]: withVersionFallback(
      lazy(
        () =>
          import('../components/Database/TableVersion/TableVersion.component')
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.TOPIC]: withVersionFallback(
      lazy(
        () => import('../components/Topic/TopicVersion/TopicVersion.component')
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DASHBOARD]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/Dashboard/DashboardVersion/DashboardVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.PIPELINE]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/Pipeline/PipelineVersion/PipelineVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.MLMODEL]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/MlModel/MlModelVersion/MlModelVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.CONTAINER]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/Container/ContainerVersion/ContainerVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.SEARCH_INDEX]: withVersionFallback(
      lazy(() => import('../components/SearchIndexVersion/SearchIndexVersion')),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DASHBOARD_DATA_MODEL]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/Dashboard/DataModel/DataModelVersion/DataModelVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.STORED_PROCEDURE]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/Database/StoredProcedureVersion/StoredProcedureVersion.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.API_ENDPOINT]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/APIEndpoint/APIEndpointVersion/APIEndpointVersion'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.METRIC]: withVersionFallback(
      lazy(() => import('../components/Metric/MetricVersion/MetricVersion')),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.CHART]: withVersionFallback(
      lazy(
        () => import('../components/Chart/ChartVersion/ChartVersion.component')
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DIRECTORY]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/DriveService/Directory/DirectoryVersion/DirectoryVersion'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.FILE]: withVersionFallback(
      lazy(
        () => import('../components/DriveService/File/FileVersion/FileVersion')
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.SPREADSHEET]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/DriveService/Spreadsheet/SpreadsheetVersion/SpreadsheetVersion'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.WORKSHEET]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/DriveService/Worksheet/WorksheetVersion/WorksheetVersion'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DATABASE]: withVersionFallback(
      lazy(() => import('../pages/DatabaseVersionPage/DatabaseVersionPage')),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DATABASE_SCHEMA]: withVersionFallback(
      lazy(
        () =>
          import('../pages/DatabaseSchemaVersionPage/DatabaseSchemaVersionPage')
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.DATA_PRODUCT]: withVersionFallback(
      lazy(
        () =>
          import(
            '../components/DataProducts/DataProductsPage/DataProductsPage.component'
          )
      ),
      TAB_CONTENT_FALLBACK
    ),
    [EntityType.API_COLLECTION]: withVersionFallback(
      lazy(() => import('../pages/APICollectionPage/APICollectionVersionPage')),
      TAB_CONTENT_FALLBACK
    ),
  };

  public getEntityVersionComponent<
    T extends keyof EntityVersionClassBase['componentMap']
  >(entityType: T) {
    return this.componentMap[entityType] ?? null;
  }

  public getEntityDetailComponent(entityType: string): FC | null {
    return entityUtilClassBase.getEntityDetailComponent(entityType);
  }
}

const entityVersionClassBase = new EntityVersionClassBase();

export { EntityVersionClassBase };
export default entityVersionClassBase;
