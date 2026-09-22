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
import { SearchHitBody } from '../../interface/search.interface';
import { SourceType } from '../../interface/source.interface';
import { ExploreSearchIndex } from '../Explore/ExplorePage.interface';

export type { SourceType } from '../../interface/source.interface';

export interface SearchedDataProps {
  children?: ReactNode;
  selectedEntityId: string;
  data: SearchHitBody<ExploreSearchIndex, SourceType>[];
  isLoading?: boolean;
  totalValue: number;
  fetchLeftPanel?: () => ReactNode;
  isSummaryPanelVisible: boolean;
  showResultCount?: boolean;
  showRankingDetails?: boolean;
  isFilterSelected: boolean;
  handleSummaryPanelDisplay?: (
    details: SearchedDataProps['data'][number]['_source'],
    entityType: string
  ) => void;
  filter?: Qs.ParsedQs;
}
