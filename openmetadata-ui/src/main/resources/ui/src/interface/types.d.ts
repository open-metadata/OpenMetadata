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

declare module 'Models' {
  import { ChangeDescription } from '../generated/entity/data/dashboard';
  import { EntityReference } from '../generated/type/entityReference';
  import { TagLabel } from '../generated/type/tagLabel';
  import { Paging } from './../generated/type/paging';

  export interface RestoreRequestType {
    id: string;
  }

  export type Match = {
    params: {
      searchQuery: string;
    };
  };
  export type PaginationProps = {
    sizePerPage: number;
    totalNumberOfValues: number;
    currentPage: number;
    paginate: Function;
  };
  export type Feed = {
    addressedToEntity: {
      description: string;
      href: string;
      id: string;
      name: string;
      type: string;
    };
    from: string;
    message: string;
  };

  export type FeedById = {
    from: string;
    message: string;
    postTs: string;
  };

  export type ServiceOption = {
    id: string;
    brokers?: Array<string>;
    description: string;
    dashboardUrl?: string;
    ingestionSchedule?: {
      repeatFrequency: string;
      startDate: string;
    };
    jdbc?: { connectionUrl: string; driverClass: string };
    name: string;
    schemaRegistry?: string;
    serviceType: string;
  };

  export type MockColumn = {
    columnId: number;
    name: string;
    columnDataType: string;
    description: string;
    selected: boolean;
    piiTags?: Array<string>;
  };

  export type EntityTags = {
    isRemovable?: boolean;
  } & TagLabel;

  export type TableColumn = {
    name: string;
    columnDataType: string;
    description: string;
    fullyQualifiedName: string;
    tags: Array<ColumnTags>;
    columnConstraint?: string;
    ordinalPosition: number;
  };

  export type Stats = {
    count: number;
    percentileRank: number;
  };

  export type UsageSummary = {
    dailyStats: Stats;
    date: string;
    monthlyStats: Stats;
    weeklyStats: Stats;
  };

  export type ColumnJoin = {
    fullyQualifiedName: string;
    joinCount: number;
  };

  export type ColumnJoins = {
    columnName: string;
    joinedWith: Array<ColumnJoin>;
  };

  export type TableJoinsData = {
    startDate: string;
    dayCount: number;
    columnJoins: Array<ColumnJoins>;
  };

  export type LoadingState = 'initial' | 'waiting' | 'success';

  export type TableDetail = {
    description: string;
    name: string;
    fullyQualifiedName: string;
    columns: Array<TableColumn>;
    database: { name: string };
    owner?: {
      name?: string;
      id: string;
      type: 'user' | 'team';
      displayName?: string;
    };
    tags: Array<ColumnTags>;
    usageSummary: UsageSummary;
    joins: TableJoinsData;
    tier?: string;
  };

  export type Bucket = {
    key: string;
    doc_count: number;
    label?: string;
  };
  type AggregationType = {
    title: string;
    buckets: Array<Bucket>;
  };
  export type Sterm = {
    doc_count_error_upper_bound: number;
    sum_other_doc_count: number;
    buckets: Array<Bucket>;
  };

  export interface Aggregation {
    'sterms#Platform': Sterm;
    'sterms#Cluster': Sterm;
    'sterms#Tags': Sterm;
  }
  export type TableEntity = {
    id: string;
    href: string;
    tableType: string;
    fullyQualifiedName: string;
    tableConstraints?: string;
    followers?: Array<string>;
    tags?: Array<string>;
  } & TableDetail;

  export type UserProfile = {
    images: Record<string, string>;
  };

  export type SlackChatConfig = {
    slackUrl: string;
  };

  export type FormattedTableData = {
    id: string;
    name: string;
    displayName: string;
    description: string;
    fullyQualifiedName: string;
    owner: EntityReference;
    tableType?: string;
    tags: string[] | TagLabel[];
    dailyStats?: number;
    dailyPercentileRank?: number;
    weeklyStats?: number;
    weeklyPercentileRank?: number;
    service?: string;
    serviceType?: string;
    tier: string | TagLabel;
    highlight?: Record<string, string[]>;
    index: string;
    type?: string;
    database?: string;
    databaseSchema?: string;
    deleted?: boolean;
    entityType?: string;
    changeDescription?: ChangeDescription;
  };

  export type FormattedTeamsData = {
    name: string;
    displayName: string;
    type: string;
    id: string;
    teamType: string;
  };

  export type SearchedUsersAndTeams = {
    users: User[];
    teams: Team[];
    usersTotal?: number;
    teamsTotal?: number;
  };

  export type TagOption = {
    fqn: string;
    source: string;
  };

  export interface FormattedGlossarySuggestion {
    deleted: boolean;
    description: string;
    display_name: string;
    entity_type: string;
    fullyQualifiedName: string;
    glossary_id: string;
    glossary: { name: string };
    last_updated_timestamp: number;
    name: string;
  }

  export interface GlossarySuggestionHit {
    text: string;
    _index?: string;
    _type?: string;
    _id?: string;
    _score?: number;
    _source: FormattedGlossarySuggestion;
  }

  export interface AssetsDataType {
    data: FormattedTableData[];
    total: number;
    currPage: number;
  }

  export type NewUser = {
    name: string;
    email: string;
    picture: string;
    // Add other fields from oidc response as necessary
  };

  export type ClientAuth = {
    authority: string;
    client_id: string;
    provider?: 'google' | 'okta' | 'auth0';
    callbackUrl?: string;
    signingIn?: boolean;
  };

  export type Table = {
    id: string;
    type?: string;
    name: string;
    description: string;
    href: string;
    fullyQualifiedName: string;
  };

  export type StateInfo = {
    count: number;
    percentileRank: number;
  };

  export type UsageState = {
    dailyStats: StateInfo;
    weeklyStats: StateInfo;
    monthlyStats: StateInfo;
    date: string;
  };

  export type Database = {
    description: string;
    displayName?: string;
    fullyQualifiedName: string;
    href: string;
    id: string;
    name: string;
    owner: {
      description: string;
      href: string;
      id: string;
      name: string;
      type: string;
    };
    service: {
      description: string;
      href: string;
      id: string;
      name: string;
      type: string;
    };
    tables: Table[];
    usageSummary: UsageState;
  };

  export type SearchHit = {
    _index?: string;
    _type?: string;
    _id?: string;
    _score?: number;
    _source: FormattedTableData;
  };

  export type SearchResponse = {
    data: {
      hits: {
        total: {
          value: number;
          relation?: string;
        };
        hits: Array<SearchHit>;
      };
      aggregations: Record<string, Sterm>;
    };
  };

  export type ServiceCollection = {
    name: string;
    value: string;
  };

  export type ServiceData = {
    collection: {
      documentation: string;
      href: string;
      name: string;
    };
  };

  export type ServiceTypes =
    | 'databaseServices'
    | 'messagingServices'
    | 'dashboardServices'
    | 'pipelineServices'
    | 'mlmodelServices'
    | 'metadataServices';

  export type ServiceCategory = {
    databases: string;
    messaging: string;
    dashboards: string;
    pipelines: string;
    mlModels: string;
  };

  export type SampleData = {
    columns: Array<string>;
    rows: Array<Array<string>>;
  };

  export type SearchDataFunctionType = {
    queryString: string;
    from: number;
    size?: number;
    filters: string;
    sortField: string;
    sortOrder: string;
    searchIndex?: string;
  };

  export type EntityCounts = {
    tableCount: number;
    topicCount: number;
    dashboardCount: number;
    pipelineCount: number;
  };

  export interface Follower {
    description: string;
    href: string;
    id: string;
    name: string;
    type: string;
  }

  export interface Owner {
    description: string;
    href: string;
    id: string;
    name: string;
    type: string;
  }

  export interface Service {
    description: string;
    href: string;
    id: string;
    name: string;
    type: string;
  }

  // topic interface end

  interface RecentlyViewedData {
    displayName?: string;
    entityType: 'table' | 'topic' | 'dashboard' | 'pipeline';
    fqn: string;
    serviceType?: string;
    timestamp: number;
    id: string;
  }

  interface RecentlySearchedData {
    term: string;
    timestamp: number;
  }
  export interface RecentlyViewed {
    data: Array<RecentlyViewedData>;
  }
  export interface RecentlySearched {
    data: Array<RecentlySearchedData>;
  }

  export type DatasetSchemaTableTab = 'schema' | 'sample_data';
  export type LineagePos = 'from' | 'to';
  export interface LeafNodes {
    upStreamNode: Array<string>;
    downStreamNode: Array<string>;
  }
  export interface LoadingNodeState {
    id: string | undefined;
    state: boolean;
  }

  export type ExtraInfo = {
    key?: string;
    value: string | number | React.ReactNode;
    id?: string;
    isLink?: boolean;
    placeholderText?: string;
    openInNewTab?: boolean;
    showLabel?: boolean;
    avatarWidth?: string;
    profileName?: string;
    isEntityCard?: boolean;
    isEntityDetails?: boolean;
  };

  export interface FormErrorData {
    [key: string]: string | undefined;
  }

  export type StepperStepType = {
    name: string;
    step: number;
  };

  type DynamicObj = {
    [key: string]: string;
  };

  type DynamicFormFieldType = {
    key: string;
    value: string;
  };

  export type ServicesData = {
    id?: string;
    description?: string | undefined;
    ingestionSchedule?:
      | {
          repeatFrequency: string;
          startDate: string;
        }
      | undefined;
    name?: string;
    serviceType?: string;
    databaseConnection?: {
      hostPort: string;
      password: string;
      username: string;
      database: string;
      connectionArguments: DynamicObj;
      connectionOptions: DynamicObj;
    };
    brokers?: Array<string>;
    schemaRegistry?: string;
    dashboardUrl?: string;
    username?: string;
    password?: string;
    url?: string;
    api_key?: string;
    site_name?: string;
    api_version?: string;
    server?: string;
    env?: string;
    pipelineUrl?: string;
  };

  export interface EditorContentRef {
    getEditorContent: () => string;
    clearEditorContent: () => void;
  }

  // Feed interfaces and types
  export interface EntityFieldThreadCount {
    count: number;
    entityLink: string;
  }

  export type EntityThreadField = 'description' | 'columns' | 'tags' | 'tasks';
  export interface EntityFieldThreads {
    entityLink: string;
    count: number;
    entityField: string;
  }

  export type ImageShape = 'circle' | 'square';

  export interface SelectableOption {
    readonly label: string;
    readonly value: string;
  }

  export interface ScrollHandle {
    left: boolean;
    right: boolean;
  }

  export interface PagingResponse<T> {
    data: T;
    paging: Paging;
  }

  export type Status = 'initial' | 'waiting' | 'success';

  export interface CurrentState {
    id: string;
    state: string;
  }
}
