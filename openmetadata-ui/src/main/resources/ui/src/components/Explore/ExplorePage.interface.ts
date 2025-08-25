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

import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { SORT_ORDER } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { APICollection } from '../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Container } from '../../generated/entity/data/container';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Directory } from '../../generated/entity/data/directory';
import { Glossary } from '../../generated/entity/data/glossary';
import { Metric } from '../../generated/entity/data/metric';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { SearchIndex as SearchIndexEntity } from '../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../generated/entity/data/storedProcedure';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { APIService } from '../../generated/entity/services/apiService';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { DriveService } from '../../generated/entity/services/driveService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { MlmodelService } from '../../generated/entity/services/mlmodelService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { SearchService } from '../../generated/entity/services/searchService';
import { StorageService } from '../../generated/entity/services/storageService';
import { TestCase } from '../../generated/tests/testCase';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import { QueryFilterInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';

export type UrlParams = {
  searchQuery: string;
  tab: string;
};

export type ExploreSearchIndex =
  | SearchIndex.DATA_PRODUCT
  | SearchIndex.TABLE
  | SearchIndex.PIPELINE
  | SearchIndex.DASHBOARD
  | SearchIndex.DATABASE
  | SearchIndex.DATABASE_SCHEMA
  | SearchIndex.MLMODEL
  | SearchIndex.TOPIC
  | SearchIndex.CONTAINER
  | SearchIndex.GLOSSARY_TERM
  | SearchIndex.TAG
  | SearchIndex.SEARCH_INDEX
  | SearchIndex.STORED_PROCEDURE
  | SearchIndex.DASHBOARD_DATA_MODEL
  | SearchIndex.API_COLLECTION_INDEX
  | SearchIndex.API_ENDPOINT_INDEX
  | SearchIndex.METRIC_SEARCH_INDEX;

export type SearchHitCounts = Record<ExploreSearchIndex, number>;

export interface ExploreProps {
  aggregations?: Aggregations;
  activeTabKey: SearchIndex;
  tabItems: ItemType[];

  searchResults?: SearchResponse<ExploreSearchIndex>;

  onChangeAdvancedSearchQuickFilters: (
    queryFilter: QueryFilterInterface | undefined
  ) => void;

  searchIndex: SearchIndex.DATA_ASSET | ExploreSearchIndex;
  onChangeSearchIndex: (searchIndex: ExploreSearchIndex) => void;

  sortValue: string;
  onChangeSortValue: (sortValue: string) => void;

  sortOrder: string;
  onChangeSortOder: (sortOder: SORT_ORDER) => void;

  showDeleted?: boolean;
  onChangeShowDeleted: (showDeleted: boolean) => void;

  onChangePage?: (page: number, size?: number) => void;

  loading?: boolean;

  quickFilters?: QueryFilterInterface;
  isElasticSearchIssue?: boolean;
}

export interface ExploreQuickFilterField {
  key: string;
  label: string;
  value: SearchDropdownOption[] | undefined;
}

// Type for all the explore tab entities
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
  | Metric;

export type EntityWithServices =
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | DashboardDataModel
  | Database
  | DatabaseSchema
  | SearchIndexEntity
  | APICollection
  | APIEndpoint
  | Directory;

export type EntityServiceUnion =
  | DatabaseService
  | MessagingService
  | DashboardService
  | PipelineService
  | MlmodelService
  | StorageService
  | SearchService
  | APIService
  | DriveService;

export interface EntityDetailsObjectInterface {
  details: SearchedDataProps['data'][number]['_source'];
}
