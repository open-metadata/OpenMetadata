/*
 *  Copyright 2021 Collate
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
  import { TagLabel } from '../generated/type/tagLabel';
  export interface EntityReference {
    deleted?: boolean;

    description?: string;

    displayName?: string;

    fullyQualifiedName?: string;

    href?: string;

    id: string;

    name?: string;

    type: string;
  }

  export type Match = {
    params: {
      searchQuery: string;
    };
  };
  export type FilterObject = {
    [key: string]: Array<string>;
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

  export type Paging = {
    after: string;
    before: string;
    total?: number;
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

  export type UserProfile = {
    images: Record<string, string>;
  };

  export type User = {
    displayName: string;
    isBot: boolean;
    isAdmin: boolean;
    id: string;
    name: string;
    profile: UserProfile;
    teams: Array<UserTeam>;
    follows?: Array<UserTeam>;
    timezone: string;
    href: string;
  };

  export type SlackChatConfig = {
    apiToken: string;
    botName: string;
    channels: string[];
  };

  export interface BaseFormattedData {
    name: string;
    fullyQualifiedName: string;
    displayName: string;
    email: string;
    type: string;
    id: string;
    owner?: EntityReference;
    description?: string;
    tags?: string[] | TagLabel[];
    tier?: string | TagLabel;
    deleted: boolean;
    entityType?: string;
    index: string;
    serviceType: string;
  }

  export interface FormattedTableData extends BaseFormattedData {
    tableType?: string;
    dailyStats?: number;
    dailyPercentileRank?: number;
    weeklyStats?: number;
    weeklyPercentileRank?: number;
    service?: string;
    highlight?: {
      description: string[];
      name: string[];
    };
    type?: string;
    database?: string;
    databaseSchema?: string;
  }

  export type FormattedUsersData = BaseFormattedData;

  export interface FormattedTeamsData extends BaseFormattedData {
    isJoinable: boolean;
  }

  export interface FormattedGlossaryTermData extends BaseFormattedData {
    fqdn?: string;
    glossary: {
      name: string;
    };
  }

  export type FormattedDashboardData = BaseFormattedData;

  export type FormattedTopicData = BaseFormattedData;

  export type FormattedTagData = BaseFormattedData;

  export type FormattedMLModelData = BaseFormattedData;

  export type FormattedPipelineData = BaseFormattedData;

  export type SearchedUsersAndTeams = {
    users: FormattedUsersData[];
    teams: FormattedTeamsData[];
  };

  export type TagOption = {
    fqn: string;
    source: string;
  };

  export interface GlossarySuggestionHit {
    text: string;
    _index?: string;
    _type?: string;
    _id?: string;
    _score?: number;
    _source: FormattedGlossaryTermData;
  }

  export interface GlossaryTermAssets {
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
    provider?: 'google' | 'okta' | 'auth0'; // TODO: add 'github' after adding support for Github SSO
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

  export type Team = {
    id: string;
    name: string;
    displayName: string;
    description: string;
    href: string;
    users: Array<UserTeam>;
    owns: Array<UserTeam>;
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
    | 'mlmodelServices';

  export type SampleData = {
    columns: Array<string>;
    rows: Array<Array<string>>;
  };

  export type EntityCounts = {
    tableCount: number;
    topicCount: number;
    dashboardCount: number;
    pipelineCount: number;
  };

  // topic interface start
  export interface Topic {
    cleanupPolicies: string[];
    description: string;
    followers: Follower[];
    fullyQualifiedName: string;
    href: string;
    id: string;
    maximumMessageSize: number;
    minimumInSyncReplicas: number;
    name: string;
    owner: Owner;
    partitions: number;
    retentionSize: number;
    retentionTime: number;
    schemaText: string;
    schemaType: string;
    service: Service;
    tags: ColumnTags[];
  }

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
    isLink?: boolean;
    placeholderText?: string;
    openInNewTab?: boolean;
    showLabel?: boolean;
    avatarWidth?: string;
    profileName?: string;
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

  export interface UserPermissions {
    EditOwner: boolean;
    EditDescription: boolean;
    EditLineage: boolean;
    EditTags: boolean;
    TeamEditUsers: boolean;
  }
  export interface EditorContentRef {
    getEditorContent: () => string;
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
}
