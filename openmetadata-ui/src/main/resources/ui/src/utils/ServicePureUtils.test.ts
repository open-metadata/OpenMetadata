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

import { ServiceCategory } from '../enums/service.enum';
import { StorageServiceType } from '../generated/entity/data/container';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import {
  getServiceCategoryLabel,
  shouldTestConnection,
} from './ServicePureUtils';

describe('shouldTestConnection', () => {
  it.each([
    DatabaseServiceType.CustomDatabase,
    MessagingServiceType.CustomMessaging,
    DashboardServiceType.CustomDashboard,
    MlModelServiceType.CustomMlModel,
    PipelineServiceType.CustomPipeline,
    StorageServiceType.CustomStorage,
    SearchServiceType.CustomSearch,
    DriveServiceType.CustomDrive,
  ])('should return false for %s', (serviceType) => {
    expect(shouldTestConnection(serviceType)).toBe(false);
  });

  it.each([
    DatabaseServiceType.Mysql,
    DashboardServiceType.Superset,
    SearchServiceType.ElasticSearch,
  ])('should return true for %s', (serviceType) => {
    expect(shouldTestConnection(serviceType)).toBe(true);
  });
});

describe('getServiceCategoryLabel', () => {
  it.each([
    [ServiceCategory.DATABASE_SERVICES, 'label.database-plural'],
    [ServiceCategory.METADATA_SERVICES, 'label.catalog-plural'],
    [ServiceCategory.SEARCH_SERVICES, 'label.search-engine-plural'],
    [ServiceCategory.API_SERVICES, 'label.api-uppercase-plural'],
  ])('labels %s without the word Service', (category, label) => {
    expect(getServiceCategoryLabel(category)).toBe(label);
  });

  it('falls back to a readable name for a category outside the map', () => {
    expect(getServiceCategoryLabel('llmServices')).toBe('Llm Services');
  });
});
