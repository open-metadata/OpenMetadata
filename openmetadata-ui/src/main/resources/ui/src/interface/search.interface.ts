/*
 *  Copyright 2022 Collate.
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

import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { DataInsightIndex } from '../enums/DataInsight.enum';
import { SearchIndex } from '../enums/search.enum';
import { Tag } from '../generated/entity/classification/tag';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Query } from '../generated/entity/data/query';
import { SearchIndex as SearchIndexEntity } from '../generated/entity/data/searchIndex';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Domain } from '../generated/entity/domains/domain';
import { DashboardService } from '../generated/entity/services/dashboardService';
import { DatabaseService } from '../generated/entity/services/databaseService';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { MessagingService } from '../generated/entity/services/messagingService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import { PipelineService } from '../generated/entity/services/pipelineService';
import { SearchService } from '../generated/entity/services/searchService';
import { Team } from '../generated/entity/teams/team';
import { User } from '../generated/entity/teams/user';
import { TestCase } from '../generated/tests/testCase';
import { TestSuite } from '../generated/tests/testSuite';
import { TagLabel } from '../generated/type/tagLabel';
import { AggregatedCostAnalysisReportDataSearchSource } from './data-insight.interface';

/**
 * The `keyof` operator, when applied to a union type, expands to the keys are common for
 * all members of the union.
 *
 * keyof { key1: string; key2: string; } | { key1: string } == 'key1'
 *
 * KeysOfUnion expands to the union of all keys from all members of the union.
 *
 * KeysOfUnion<{ key1: string; key2: string; } | { key1: string }> == 'key1' | 'key2'
 */
export type KeysOfUnion<T> = T extends T ? keyof T : never;

interface SearchSourceBase {
  tier?: TagLabel;
  /* Elasticsearch does NOT store a `type` field for these indecencies.
  searchAPI.searchQuery creates a `type` field by copying the value in `entityType`.
  This is done so the types bellow implement EntityReference */
  type: string;
  entityType: string;
}

/*
  The following are interfaces for the objects returned by Elasticsearch.

  All of these extend EntityInterface (as set out in the comments), but explicitly having them
  extend the EntityInterface type is not possible because of type mismatches -
  there are fields which are optional in EntityReference but not in the object interface. By design
  typescript does not allow this for interface extension.
  (More here: https://github.com/microsoft/TypeScript/issues/16936)
 */
export interface TableSearchSource extends SearchSourceBase, Table {} // extends EntityInterface

export interface DashboardSearchSource extends SearchSourceBase, Dashboard {} // extends EntityInterface

export interface PipelineSearchSource extends SearchSourceBase, Pipeline {} // extends EntityInterface

export interface MlmodelSearchSource extends SearchSourceBase, Mlmodel {} // extends EntityInterface

export interface TopicSearchSource extends SearchSourceBase, Topic {} // extends EntityInterface

export interface UserSearchSource extends SearchSourceBase, User {} // extends EntityInterface

export interface TeamSearchSource extends SearchSourceBase, Team {} // extends EntityInterface

export interface ContainerSearchSource extends SearchSourceBase, Container {} // extends EntityInterface
export interface DataBaseSchemaSearchSource
  extends SearchSourceBase,
    DatabaseSchema {} // extends EntityInterface
export interface DatabaseSearchSource extends SearchSourceBase, Database {} // extends EntityInterface

export interface DomainSearchSource extends SearchSourceBase, Domain {} // extends EntityInterface
export interface StoredProcedureSearchSource
  extends SearchSourceBase,
    StoredProcedure {} // extends EntityInterface

export interface SearchIndexSearchSource
  extends SearchSourceBase,
    SearchIndexEntity {} // extends EntityInterface
export interface DataProductSearchSource
  extends SearchSourceBase,
    DataProduct {} // extends EntityInterface

export interface DashboardDataModelSearchSource
  extends SearchSourceBase,
    DashboardDataModel {} // extends EntityInterface

export interface TagClassSearchSource extends SearchSourceBase, Tag {
  id: string; // Tag is generated with the `id` field as optional, which is should not
} // extends EntityInterface

export interface GlossarySearchSource extends SearchSourceBase, Glossary {} // extends EntityInterface
export interface GlossaryTermSearchSource
  extends SearchSourceBase,
    GlossaryTerm {} // extends EntityInterface

export interface QuerySearchSource extends SearchSourceBase, Query {} // extends EntityInterface
export interface TestCaseSearchSource
  extends SearchSourceBase,
    Exclude<TestCase, 'testSuite'> {
  testSuites: TestSuite[];
} // extends EntityInterface
export interface TestSuiteSearchSource extends SearchSourceBase, TestSuite {}

export interface IngestionPipelineSearchSource
  extends SearchSourceBase,
    IngestionPipeline {}

export interface DatabaseServiceSearchSource
  extends SearchSourceBase,
    DatabaseService {}
export interface MessagingServiceSearchSource
  extends SearchSourceBase,
    MessagingService {}
export interface DashboardServiceSearchSource
  extends SearchSourceBase,
    DashboardService {}
export interface PipelineServiceSearchSource
  extends SearchSourceBase,
    PipelineService {}
export interface MlModelServiceSearchSource
  extends SearchSourceBase,
    MlmodelService {}

export interface SearchServiceSearchSource
  extends SearchSourceBase,
    SearchService {}

export interface StorageServiceSearchSource
  extends SearchSourceBase,
    SearchService {}

export type ExploreSearchSource =
  | TableSearchSource
  | DashboardSearchSource
  | MlmodelSearchSource
  | TopicSearchSource
  | PipelineSearchSource
  | ContainerSearchSource
  | GlossarySearchSource
  | QuerySearchSource
  | UserSearchSource
  | TeamSearchSource
  | TagClassSearchSource
  | StoredProcedureSearchSource
  | DashboardDataModelSearchSource
  | TestCaseSearchSource
  | DatabaseSearchSource
  | DataBaseSchemaSearchSource
  | DatabaseServiceSearchSource
  | DashboardServiceSearchSource
  | PipelineServiceSearchSource
  | MlModelServiceSearchSource
  | MessagingServiceSearchSource
  | SearchServiceSearchSource
  | StorageServiceSearchSource
  | DomainSearchSource
  | SearchIndexSearchSource;

export type SearchIndexSearchSourceMapping = {
  [SearchIndex.ALL]: TableSearchSource;
  [SearchIndex.DATA_ASSET]: TableSearchSource;
  [SearchIndex.TABLE]: TableSearchSource;
  [SearchIndex.MLMODEL]: MlmodelSearchSource;
  [SearchIndex.PIPELINE]: PipelineSearchSource;
  [SearchIndex.DASHBOARD]: DashboardSearchSource;
  [SearchIndex.GLOSSARY]: GlossarySearchSource;
  [SearchIndex.GLOSSARY_TERM]: GlossaryTermSearchSource;
  [SearchIndex.TEAM]: TeamSearchSource;
  [SearchIndex.USER]: UserSearchSource;
  [SearchIndex.TOPIC]: TopicSearchSource;
  [SearchIndex.TAG]: TagClassSearchSource;
  [SearchIndex.CONTAINER]: ContainerSearchSource;
  [SearchIndex.QUERY]: QuerySearchSource;
  [SearchIndex.TEST_CASE]: TestCaseSearchSource;
  [SearchIndex.DATABASE_SCHEMA]: DataBaseSchemaSearchSource;
  [SearchIndex.DATABASE]: DatabaseSearchSource;
  [SearchIndex.DATABASE_SERVICE]: DatabaseServiceSearchSource;
  [SearchIndex.DASHBOARD_SERVICE]: DashboardServiceSearchSource;
  [SearchIndex.PIPELINE_SERVICE]: PipelineServiceSearchSource;
  [SearchIndex.ML_MODEL_SERVICE]: MlModelServiceSearchSource;
  [SearchIndex.MESSAGING_SERVICE]: MessagingServiceSearchSource;
  [SearchIndex.SEARCH_SERVICE]: SearchServiceSearchSource;
  [SearchIndex.STORAGE_SERVICE]: StorageServiceSearchSource;
  [SearchIndex.DOMAIN]: DomainSearchSource;
  [SearchIndex.SEARCH_INDEX]: SearchIndexSearchSource;
  [SearchIndex.STORED_PROCEDURE]: StoredProcedureSearchSource;
  [SearchIndex.DASHBOARD_DATA_MODEL]: DashboardDataModelSearchSource;
  [SearchIndex.DATA_PRODUCT]: DataProductSearchSource;
  [SearchIndex.TEST_SUITE]: TestSuiteSearchSource;
  [SearchIndex.INGESTION_PIPELINE]: IngestionPipelineSearchSource;
};

export type SearchRequest<
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  > = KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
> = {
  pageNumber?: number;
  pageSize?: number;
  searchIndex?: SI;
  query?: string;
  queryFilter?: Record<string, unknown>;
  postFilter?: Record<string, unknown>;
  sortField?: string;
  sortOrder?: string;
  includeDeleted?: boolean;
  trackTotalHits?: boolean;
  filters?: string;
} & (
  | {
      fetchSource: true;
      includeFields?: TIncludeFields[];
    }
  | {
      fetchSource?: false;
    }
);

export type SuggestRequest<
  SI extends SearchIndex | SearchIndex[],
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI extends Array<SearchIndex>
      ? SI[number]
      : SI]
  >
> = {
  query?: string;
  searchIndex?: SI;
  field?: string;
} & (
  | {
      fetchSource: true;
      includeFields?: TIncludeFields[];
    }
  | {
      fetchSource: false;
    }
);

export interface SearchHitBody<SI extends SearchIndex | DataInsightIndex, T> {
  _index: SI;
  _type?: string;
  _id?: string;
  _score?: number;
  highlight?: Record<string, string[]>;
  sort?: number[];
  _source: T;
}

type SearchIndexSearchHitBodyMapping<
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SearchIndex]
  >
> = {
  [SI in SearchIndex]: SearchHitBody<
    SI,
    Pick<
      SearchIndexSearchSourceMapping[SI],
      TIncludeFields & keyof SearchIndexSearchSourceMapping[SI]
    >
  >;
};

export interface SearchResponse<
  SI extends SearchIndex,
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI]
  > = KeysOfUnion<SearchIndexSearchSourceMapping[SI]>
> {
  took?: number;
  timed_out?: boolean;
  hits: {
    total: {
      value: number;
      relation?: string;
    };
    hits: SearchIndexSearchHitBodyMapping<TIncludeFields>[SI][];
  };
  aggregations: Aggregations;
}

export type Aggregations = Record<string, { buckets: Bucket[] }>;

export type DataInsightSearchResponse = {
  took?: number;
  timed_out?: boolean;
  hits: {
    total: {
      value: number;
      relation?: string;
    };
    hits: SearchHitBody<
      DataInsightIndex,
      AggregatedCostAnalysisReportDataSearchSource
    >[];
  };
  aggregations: Aggregations;
};

/**
 * Because we are using an older version of typescript-eslint, defining
 * ```ts
 * export type AggregationEntry = [string, { buckets: Bucket[] };
 * ```
 * causes the error: Cannot read property of 'map' undefined
 * This is a workaround to get this type working correctly by using the ReturnType of Object.entries
 */
const wrapperAggregationsEntries = () => Object.entries({} as Aggregations);

export type AggregationEntry = ReturnType<
  typeof wrapperAggregationsEntries
>[number];

export type AggregationType = {
  title: string;
  buckets: Bucket[];
};

export interface Bucket {
  key: string;
  doc_count: number;
  label?: string;
}

export interface SuggestOption<SI extends SearchIndex, T> {
  text: string;
  _index: SI;
  _id: string;
  _source: T;
}

type SearchIndexSuggestHitBodyMapping<
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SearchIndex]
  >
> = {
  [SI in SearchIndex]: SuggestOption<
    SI,
    Pick<
      SearchIndexSearchSourceMapping[SI],
      TIncludeFields & keyof SearchIndexSearchSourceMapping[SI]
    >
  >;
};

export type SuggestResponse<
  SI extends SearchIndex,
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI]
  > = KeysOfUnion<SearchIndexSearchSourceMapping[SI]>
> = SearchIndexSuggestHitBodyMapping<TIncludeFields>[SI][];

export type RawSuggestResponse<
  SI extends SearchIndex,
  TIncludeFields extends KeysOfUnion<
    SearchIndexSearchSourceMapping[SI]
  > = KeysOfUnion<SearchIndexSearchSourceMapping[SI]>
> = {
  suggest: {
    'metadata-suggest': Array<{
      options: SuggestResponse<SI, TIncludeFields>;
    }>;
  };
};

export type SearchSourceAlias = SearchedDataProps['data'][number]['_source'];
