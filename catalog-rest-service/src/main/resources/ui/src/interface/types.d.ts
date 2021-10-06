/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/
declare module 'Models' {
  import { TagLabel } from '../generated/type/tagLabel';

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

  export type ColumnTags = {
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
  };

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
    };
    tags: Array<ColumnTags>;
    usageSummary: UsageSummary;
    joins: TableJoinsData;
    tier?: string;
  };

  export type Bucket = {
    key: string;
    doc_count: number;
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

  export type User = {
    displayName: string;
    isBot: boolean;
    isAdmin: boolean;
    id: string;
    name: string;
    profile: UserProfile;
    teams: Array<UserTeam>;
    timezone: string;
    href: string;
  };

  export type FormatedTableData = {
    id: string;
    name: string;
    description: string;
    fullyQualifiedName: string;
    owner: string;
    tableType?: string;
    tags: string[];
    dailyStats?: number;
    dailyPercentileRank?: number;
    weeklyStats?: number;
    weeklyPercentileRank?: number;
    service?: string;
    serviceType?: string;
    tier: string;
    highlight?: {
      description: string[];
      table_name: string[];
    };
    index: string;
  };

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

  export type SearchHit = {
    _index?: string;
    _type?: string;
    _id?: string;
    _score?: number;
    _source: FormatedTableData;
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
    | 'pipelineServices';

  export type SampleData = {
    columns: Array<string>;
    rows: Array<Array<string>>;
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
    entityType: 'dataset' | 'topic' | 'dashboard';
    fqn: string;
    serviceType?: string;
    timestamp: number;
  }
  export interface RecentlyViewed {
    data: Array<RecentlyViewedData>;
  }
}
