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

import Qs from 'qs';
import { ReactNode } from 'react';
import { Style } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel } from '../../generated/type/tagLabel';
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
  SearchHitBody,
  SearchIndexSearchSource,
  StoredProcedureSearchSource,
  TableSearchSource,
  TagClassSearchSource,
  TeamSearchSource,
  TestCaseSearchSource,
  TopicSearchSource,
  UserSearchSource,
} from '../../interface/search.interface';
import { ExploreSearchIndex } from '../Explore/ExplorePage.interface';

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
  | Pick<TopicSearchSource, Fields>
  | Pick<ContainerSearchSource, Fields>
  | Pick<PipelineSearchSource, Fields>
  | Pick<DashboardDataModelSearchSource, Fields>
  | Pick<StoredProcedureSearchSource, Fields | 'storedProcedureCode'>
  | Pick<DashboardSearchSource | MlmodelSearchSource, Fields | 'usageSummary'>
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
  owners?: Partial<
    Pick<
      EntityReference,
      'name' | 'displayName' | 'id' | 'type' | 'fullyQualifiedName' | 'deleted'
    >
  >[];
};

export interface SearchedDataProps {
  children?: ReactNode;
  selectedEntityId: string;
  data: SearchHitBody<ExploreSearchIndex, SourceType>[];
  isLoading?: boolean;
  onPaginationChange: (value: number, pageSize?: number) => void;
  totalValue: number;
  fetchLeftPanel?: () => ReactNode;
  isSummaryPanelVisible: boolean;
  showResultCount?: boolean;
  isFilterSelected: boolean;
  handleSummaryPanelDisplay?: (
    details: SearchedDataProps['data'][number]['_source'],
    entityType: string
  ) => void;
  filter?: Qs.ParsedQs;
}
