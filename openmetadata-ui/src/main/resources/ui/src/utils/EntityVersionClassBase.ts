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

import { ComponentType, FC, lazy, LazyExoticComponent } from 'react';
import { EntityType } from '../enums/entity.enum';
import entityUtilClassBase from './EntityUtilClassBase';

type VersionComponentType = LazyExoticComponent<
  ComponentType<Record<string, unknown>>
>;

class EntityVersionClassBase {
  protected componentMap: Partial<Record<EntityType, VersionComponentType>> = {
    [EntityType.TABLE]: lazy(
      () => import('../components/Database/TableVersion/TableVersion.component')
    ),
    [EntityType.TOPIC]: lazy(
      () => import('../components/Topic/TopicVersion/TopicVersion.component')
    ),
    [EntityType.DASHBOARD]: lazy(
      () =>
        import(
          '../components/Dashboard/DashboardVersion/DashboardVersion.component'
        )
    ),
    [EntityType.PIPELINE]: lazy(
      () =>
        import(
          '../components/Pipeline/PipelineVersion/PipelineVersion.component'
        )
    ),
    [EntityType.MLMODEL]: lazy(
      () =>
        import('../components/MlModel/MlModelVersion/MlModelVersion.component')
    ),
    [EntityType.CONTAINER]: lazy(
      () =>
        import(
          '../components/Container/ContainerVersion/ContainerVersion.component'
        )
    ),
    [EntityType.SEARCH_INDEX]: lazy(
      () => import('../components/SearchIndexVersion/SearchIndexVersion')
    ),
    [EntityType.DASHBOARD_DATA_MODEL]: lazy(
      () =>
        import(
          '../components/Dashboard/DataModel/DataModelVersion/DataModelVersion.component'
        )
    ),
    [EntityType.STORED_PROCEDURE]: lazy(
      () =>
        import(
          '../components/Database/StoredProcedureVersion/StoredProcedureVersion.component'
        )
    ),
    [EntityType.API_ENDPOINT]: lazy(
      () =>
        import(
          '../components/APIEndpoint/APIEndpointVersion/APIEndpointVersion'
        )
    ),
    [EntityType.METRIC]: lazy(
      () => import('../components/Metric/MetricVersion/MetricVersion')
    ),
    [EntityType.CHART]: lazy(
      () => import('../components/Chart/ChartVersion/ChartVersion.component')
    ),
    [EntityType.DIRECTORY]: lazy(
      () =>
        import(
          '../components/DriveService/Directory/DirectoryVersion/DirectoryVersion'
        )
    ),
    [EntityType.FILE]: lazy(
      () => import('../components/DriveService/File/FileVersion/FileVersion')
    ),
    [EntityType.SPREADSHEET]: lazy(
      () =>
        import(
          '../components/DriveService/Spreadsheet/SpreadsheetVersion/SpreadsheetVersion'
        )
    ),
    [EntityType.WORKSHEET]: lazy(
      () =>
        import(
          '../components/DriveService/Worksheet/WorksheetVersion/WorksheetVersion'
        )
    ),
    [EntityType.DATABASE]: lazy(
      () => import('../pages/DatabaseVersionPage/DatabaseVersionPage')
    ),
    [EntityType.DATABASE_SCHEMA]: lazy(
      () =>
        import('../pages/DatabaseSchemaVersionPage/DatabaseSchemaVersionPage')
    ),
    [EntityType.DATA_PRODUCT]: lazy(
      () =>
        import(
          '../components/DataProducts/DataProductsPage/DataProductsPage.component'
        )
    ),
    [EntityType.API_COLLECTION]: lazy(
      () => import('../pages/APICollectionPage/APICollectionVersionPage')
    ),
  };

  public getEntityVersionComponent(
    entityType: string
  ): VersionComponentType | null {
    return this.componentMap[entityType as EntityType] ?? null;
  }

  public getEntityDetailComponent(entityType: string): FC | null {
    return entityUtilClassBase.getEntityDetailComponent(entityType);
  }
}

const entityVersionClassBase = new EntityVersionClassBase();

export { EntityVersionClassBase };
export default entityVersionClassBase;
