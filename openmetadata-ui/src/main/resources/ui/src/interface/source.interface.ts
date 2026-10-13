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

// The shape a search hit collapses to once the UI only needs the common
// display fields. It lives below the component layer because hooks, utils and
// stores all describe data in these terms; `SearchedData.interface` re-exports
// it so existing component imports keep their path.
import { Style } from '../generated/entity/data/glossaryTerm';
import { EntityReference } from '../generated/entity/type';
import { TagLabel } from '../generated/type/tagLabel';
import {
  APICollectionSearchSource,
  APIEndpointSearchSource,
  ContainerSearchSource,
  DashboardDataModelSearchSource,
  DashboardSearchSource,
  ExploreSearchSource,
  GlossarySearchSource,
  MetricSearchSource,
  MlmodelSearchSource,
  PipelineSearchSource,
  QuerySearchSource,
  SearchIndexSearchSource,
  StoredProcedureSearchSource,
  TableColumnSearchSource,
  TableSearchSource,
  TagClassSearchSource,
  TeamSearchSource,
  TestCaseSearchSource,
  TopicSearchSource,
  UserSearchSource,
} from './search.interface';

type Fields =
  | 'name'
  | 'fullyQualifiedName'
  | 'description'
  | 'serviceType'
  | 'displayName'
  | 'deleted'
  | 'service'
  | 'domains';

export type SourceType = (
  | Pick<
      TableSearchSource,
      Fields | 'usageSummary' | 'database' | 'databaseSchema' | 'tableType'
    >
  | Pick<
      TableColumnSearchSource,
      | 'name'
      | 'fullyQualifiedName'
      | 'description'
      | 'serviceType'
      | 'displayName'
      | 'service'
      | 'domains'
      | 'dataType'
      | 'dataTypeDisplay'
      | 'table'
      | 'entityType'
    >
  | Pick<TopicSearchSource, Fields>
  | Pick<ContainerSearchSource, Fields>
  | Pick<PipelineSearchSource, Fields>
  | Pick<DashboardDataModelSearchSource, Fields>
  | Pick<StoredProcedureSearchSource, Fields | 'storedProcedureCode'>
  | Pick<DashboardSearchSource, Fields | 'usageSummary' | 'charts'>
  | Pick<MlmodelSearchSource, Fields | 'usageSummary'>
  | Pick<SearchIndexSearchSource, Fields>
  | Pick<APICollectionSearchSource, Fields>
  | Pick<APIEndpointSearchSource, Fields>
  | Pick<
      MetricSearchSource,
      | 'name'
      | 'fullyQualifiedName'
      | 'description'
      | 'displayName'
      | 'deleted'
      | 'domains'
    >
  | Pick<
      Exclude<
        ExploreSearchSource,
        | TableSearchSource
        | DashboardSearchSource
        | MlmodelSearchSource
        | GlossarySearchSource
        | TagClassSearchSource
        | QuerySearchSource
        | UserSearchSource
        | TeamSearchSource
        | TestCaseSearchSource
        | SearchIndexSearchSource
        | StoredProcedureSearchSource
        | APICollectionSearchSource
        | APIEndpointSearchSource
        | MetricSearchSource
        | TableColumnSearchSource
      >,
      Fields
    >
) & {
  id?: string;
  tier?: string | TagLabel;
  tags?: TagLabel[];
  entityType?: string;
  service?: EntityReference;
  style?: Style;
  dataProducts?: EntityReference[];
  owners?: Partial<
    Pick<
      EntityReference,
      'name' | 'displayName' | 'id' | 'type' | 'fullyQualifiedName' | 'deleted'
    >
  >[];
};
