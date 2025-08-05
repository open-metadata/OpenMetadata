/*
 *  Copyright 2023 Collate.
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
import { EntityType } from '../../../enums/entity.enum';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { APICollection } from '../../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { Chart } from '../../../generated/entity/data/chart';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Metric } from '../../../generated/entity/data/metric';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { Domain } from '../../../generated/entity/domains/domain';
import { APIService } from '../../../generated/entity/services/apiService';
import { DashboardService } from '../../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../../generated/entity/services/databaseService';
import { MessagingService } from '../../../generated/entity/services/messagingService';
import { MlmodelService } from '../../../generated/entity/services/mlmodelService';
import { PipelineService } from '../../../generated/entity/services/pipelineService';
import { SearchService } from '../../../generated/entity/services/searchService';
import { SecurityService } from '../../../generated/entity/services/securityService';
import { StorageService } from '../../../generated/entity/services/storageService';
import { Team } from '../../../generated/entity/teams/team';
import { User } from '../../../generated/entity/teams/user';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';

export interface AssetSelectionModalProps {
  entityFqn: string;
  open: boolean;
  type?: AssetsOfEntity;
  onCancel: () => void;
  onSave?: () => void;
  queryFilter?: QueryFilterInterface;
  emptyPlaceHolderText?: string;
}

export type AssetsUnion =
  | EntityType.TABLE
  | EntityType.PIPELINE
  | EntityType.DASHBOARD
  | EntityType.MLMODEL
  | EntityType.TOPIC
  | EntityType.CONTAINER
  | EntityType.SEARCH_INDEX
  | EntityType.STORED_PROCEDURE
  | EntityType.DASHBOARD_DATA_MODEL
  | EntityType.GLOSSARY_TERM
  | EntityType.DATABASE_SCHEMA
  | EntityType.DATABASE
  | EntityType.DASHBOARD_SERVICE
  | EntityType.MESSAGING_SERVICE
  | EntityType.PIPELINE_SERVICE
  | EntityType.MLMODEL_SERVICE
  | EntityType.STORAGE_SERVICE
  | EntityType.DATABASE_SERVICE
  | EntityType.SEARCH_SERVICE
  | EntityType.SECURITY_SERVICE
  | EntityType.API_SERVICE
  | EntityType.API_COLLECTION
  | EntityType.API_ENDPOINT
  | EntityType.METRIC;

export type MapPatchAPIResponse = {
  [EntityType.TABLE]: Table;
  [EntityType.DASHBOARD]: Dashboard;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.CONTAINER]: Container;
  [EntityType.SEARCH_INDEX]: SearchIndex;
  [EntityType.TOPIC]: Topic;
  [EntityType.STORED_PROCEDURE]: StoredProcedure;
  [EntityType.DASHBOARD_DATA_MODEL]: DashboardDataModel;
  [EntityType.GLOSSARY_TERM]: GlossaryTerm;
  [EntityType.GLOSSARY]: Glossary;
  [EntityType.DATABASE_SCHEMA]: DatabaseSchema;
  [EntityType.DATABASE]: Database;
  [EntityType.DASHBOARD_SERVICE]: DashboardService;
  [EntityType.MESSAGING_SERVICE]: MessagingService;
  [EntityType.PIPELINE_SERVICE]: PipelineService;
  [EntityType.MLMODEL_SERVICE]: MlmodelService;
  [EntityType.STORAGE_SERVICE]: StorageService;
  [EntityType.DATABASE_SERVICE]: DatabaseService;
  [EntityType.SEARCH_SERVICE]: SearchService;
  [EntityType.TEAM]: Team;
  [EntityType.USER]: User;
  [EntityType.API_SERVICE]: APIService;
  [EntityType.API_COLLECTION]: APICollection;
  [EntityType.API_ENDPOINT]: APIEndpoint;
  [EntityType.METRIC]: Metric;
  [EntityType.TAG]: Tag;
  [EntityType.DOMAIN]: Domain;
  [EntityType.CLASSIFICATION]: Classification;
  [EntityType.CHART]: Chart;
  [EntityType.SECURITY_SERVICE]: SecurityService;
};
