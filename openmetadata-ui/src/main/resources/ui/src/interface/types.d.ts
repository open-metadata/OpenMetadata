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
  import { EntityType } from '../enums/entity.enum';
  import { CreateDashboardService } from '../generated/api/services/createDashboardService';
  import { CreateDatabaseService } from '../generated/api/services/createDatabaseService';
  import { CreateDriveService } from '../generated/api/services/createDriveService';
  import { CreateMessagingService } from '../generated/api/services/createMessagingService';
  import { CreateMlModelService } from '../generated/api/services/createMlModelService';
  import { CreatePipelineService } from '../generated/api/services/createPipelineService';
  import { CreateSearchService } from '../generated/api/services/createSearchService';
  import { CreateSecurityService } from '../generated/api/services/createSecurityService';
  import { CreateStorageService } from '../generated/api/services/createStorageService';
  import { ChangeDescription } from '../generated/entity/data/dashboard';
  import { EntityReference } from '../generated/type/entityReference';
  import { TagLabel } from '../generated/type/tagLabel';
  import { SearchEntityHits } from '../utils/APIUtils';
  import { Paging } from './../generated/type/paging';

  export interface RestoreRequestType {
    id: string;
  }

  export type ServicesUpdateRequest =
    | CreatePipelineService
    | CreateMlModelService
    | CreateDashboardService
    | CreateDatabaseService
    | CreateMessagingService
    | CreateStorageService
    | CreateSearchService
    | CreateSecurityService
    | CreateDriveService;

  export type EntityTags = {
    isRemovable?: boolean;
  } & TagLabel;

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
    columns?: TableColumn[];
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

  export interface AssetsDataType {
    isLoading?: boolean;
    data: SearchEntityHits;
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

  export type ServiceTypes =
    | 'databaseServices'
    | 'messagingServices'
    | 'dashboardServices'
    | 'pipelineServices'
    | 'mlmodelServices'
    | 'metadataServices'
    | 'storageServices'
    | 'searchServices'
    | 'apiServices'
    | 'securityServices'
    | 'driveServices';

  export type SearchDataFunctionType = {
    queryString: string;
    from: number;
    size?: number;
    filters: string;
    sortField: string;
    sortOrder: string;
    searchIndex?: string;
  };

  interface RecentlyViewedData {
    displayName?: string;
    entityType: EntityType;
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

  export type ExtraInfo = {
    key?: string;
    value: string | number | React.ReactNode;
    id?: string;
    localizationKey?: string;
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
      connectionArguments: Record<string, string>;
      connectionOptions: Record<string, string>;
    };
    brokers?: Array<string>;
    schemaRegistry?: string;
    sourceUrl?: string;
    username?: string;
    password?: string;
    url?: string;
    api_key?: string;
    site_name?: string;
    api_version?: string;
    server?: string;
    env?: string;
    sourceUrl?: string;
  };

  export type ImageShape = 'circle' | 'square';

  export interface PagingResponse<T> {
    data: T;
    paging: Paging;
  }

  export interface CurrentState {
    id: string;
    state: string;
  }

  export type PagingWithoutTotal = Omit<Paging, 'total'>;

  type EntityDetailUnion =
    | Table
    | Pipeline
    | Dashboard
    | Topic
    | Mlmodel
    | Container;

  export type DateFilterType = Record<string, { days: number; title: string }>;

  export type TagFilterOptions = {
    text: string;
    value: string;
    source: TagSource;
  };

  export type TagsData = {
    tags?: TagLabel[];
    fullyQualifiedName?: string;
    children?: TagsData[];
  };

  export interface DateRangeObject {
    startTs: number;
    endTs: number;
    key?: string;
    title?: string;
  }
}
