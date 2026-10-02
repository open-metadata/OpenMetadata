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

// Every entity the Explore surfaces can return. Hooks and stores describe
// their payloads with it, so it lives below the component layer;
// ExplorePage.interface re-exports it.
import { Kpi } from '../generated/dataInsight/kpi/kpi';
import { AppMarketPlaceDefinition } from '../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Tag } from '../generated/entity/classification/tag';
import { APICollection } from '../generated/entity/data/apiCollection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Glossary } from '../generated/entity/data/glossary';
import { Metric } from '../generated/entity/data/metric';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Query } from '../generated/entity/data/query';
import { SearchIndex as SearchIndexEntity } from '../generated/entity/data/searchIndex';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { APIService } from '../generated/entity/services/apiService';
import { DashboardService } from '../generated/entity/services/dashboardService';
import { DatabaseService } from '../generated/entity/services/databaseService';
import { DriveService } from '../generated/entity/services/driveService';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { MessagingService } from '../generated/entity/services/messagingService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import { PipelineService } from '../generated/entity/services/pipelineService';
import { SearchService } from '../generated/entity/services/searchService';
import { StorageService } from '../generated/entity/services/storageService';
import { Type } from '../generated/entity/type';
import { TestCase } from '../generated/tests/testCase';
import { TestSuite } from '../generated/tests/testSuite';

export type EntityUnion =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | DatabaseSchema
  | Database
  | Glossary
  | Tag
  | TestCase
  | DashboardDataModel
  | StoredProcedure
  | SearchIndexEntity
  | DatabaseService
  | MessagingService
  | DashboardService
  | PipelineService
  | MlmodelService
  | StorageService
  | SearchService
  | APIEndpoint
  | APIService
  | DriveService
  | APICollection
  | Metric
  | Type
  | TestSuite
  | Kpi
  | AppMarketPlaceDefinition
  | IngestionPipeline
  | Query;
