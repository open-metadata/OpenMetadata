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

import { ComponentType, FC, lazy, LazyExoticComponent, Suspense } from 'react';
import { EntityType } from '../enums/entity.enum';

const lazyComponentMap: Partial<
  Record<EntityType, LazyExoticComponent<ComponentType<any>>>
> = {
  [EntityType.DATABASE]: lazy(
    () => import('../pages/DatabaseDetailsPage/DatabaseDetailsPage')
  ),
  [EntityType.DATABASE_SCHEMA]: lazy(
    () => import('../pages/DatabaseSchemaPage/DatabaseSchemaPage.component')
  ),
  [EntityType.PIPELINE]: lazy(
    () => import('../pages/PipelineDetails/PipelineDetailsPage.component')
  ),
  [EntityType.TOPIC]: lazy(
    () => import('../pages/TopicDetails/TopicDetailsPage.component')
  ),
  [EntityType.DASHBOARD]: lazy(
    () => import('../pages/DashboardDetailsPage/DashboardDetailsPage.component')
  ),
  [EntityType.CHART]: lazy(
    () => import('../pages/ChartDetailsPage/ChartDetailsPage.component')
  ),
  [EntityType.STORED_PROCEDURE]: lazy(
    () => import('../pages/StoredProcedure/StoredProcedurePage')
  ),
  [EntityType.DASHBOARD_DATA_MODEL]: lazy(
    () => import('../pages/DataModelPage/DataModelPage.component')
  ),
  [EntityType.MLMODEL]: lazy(
    () => import('../pages/MlModelPage/MlModelPage.component')
  ),
  [EntityType.CONTAINER]: lazy(
    () => import('../pages/ContainerPage/ContainerPage')
  ),
  [EntityType.SEARCH_INDEX]: lazy(
    () => import('../pages/SearchIndexDetailsPage/SearchIndexDetailsPage')
  ),
  [EntityType.DATA_PRODUCT]: lazy(
    () =>
      import(
        '../components/DataProducts/DataProductsPage/DataProductsPage.component'
      )
  ),
  [EntityType.TABLE]: lazy(
    () => import('../pages/TableDetailsPageV1/TableDetailsPageV1')
  ),
  [EntityType.API_COLLECTION]: lazy(
    () => import('../pages/APICollectionPage/APICollectionPage')
  ),
  [EntityType.API_ENDPOINT]: lazy(
    () => import('../pages/APIEndpointPage/APIEndpointPage')
  ),
  [EntityType.METRIC]: lazy(
    () => import('../pages/MetricsPage/MetricDetailsPage/MetricDetailsPage')
  ),
  [EntityType.DIRECTORY]: lazy(
    () => import('../pages/DirectoryDetailsPage/DirectoryDetailsPage')
  ),
  [EntityType.FILE]: lazy(
    () => import('../pages/FileDetailsPage/FileDetailsPage')
  ),
  [EntityType.SPREADSHEET]: lazy(
    () => import('../pages/SpreadsheetDetailsPage/SpreadsheetDetailsPage')
  ),
  [EntityType.WORKSHEET]: lazy(
    () => import('../pages/WorksheetDetailsPage/WorksheetDetailsPage')
  ),
};

export function getEntityDetailComponent(entityType: string): FC | null {
  const LazyComponent = lazyComponentMap[entityType as EntityType];

  if (!LazyComponent) {
    return null;
  }

  const WrappedComponent: FC<any> = (props) => (
    <Suspense fallback={null}>
      <LazyComponent {...props} />
    </Suspense>
  );

  return WrappedComponent;
}
