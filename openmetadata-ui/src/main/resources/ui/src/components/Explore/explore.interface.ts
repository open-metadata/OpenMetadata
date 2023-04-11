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

import { DefaultOptionType } from 'antd/lib/select';
import { SORT_ORDER } from 'enums/common.enum';
import { Tag } from 'generated/entity/classification/tag';
import { Container } from 'generated/entity/data/container';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Database } from 'generated/entity/data/database';
import { DatabaseSchema } from 'generated/entity/data/databaseSchema';
import { Glossary } from 'generated/entity/data/glossary';
import { QueryFilterInterface } from 'pages/explore/ExplorePage.interface';
import { SearchIndex } from '../../enums/search.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { Aggregations, SearchResponse } from '../../interface/search.interface';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';
import { FilterObject } from './AdvanceSearchProvider/AdvanceSearchProvider.interface';

export type UrlParams = {
  searchQuery: string;
  tab: string;
};

export type ExploreSearchIndex =
  | SearchIndex.TABLE
  | SearchIndex.PIPELINE
  | SearchIndex.DASHBOARD
  | SearchIndex.MLMODEL
  | SearchIndex.TOPIC
  | SearchIndex.CONTAINER
  | SearchIndex.GLOSSARY
  | SearchIndex.TAG;

export type ExploreSearchIndexKey =
  | 'TABLE'
  | 'PIPELINE'
  | 'DASHBOARD'
  | 'MLMODEL'
  | 'TOPIC'
  | 'CONTAINER';

export type SearchHitCounts = Record<ExploreSearchIndex, number>;

export interface ExploreProps {
  aggregations?: Aggregations;

  tabCounts?: SearchHitCounts;

  searchResults?: SearchResponse<ExploreSearchIndex>;

  onChangeAdvancedSearchQuickFilters: (
    queryFilter: QueryFilterInterface | undefined
  ) => void;

  facetFilters?: FilterObject;
  onChangeFacetFilters: (filter: FilterObject) => void;

  searchIndex: ExploreSearchIndex;
  onChangeSearchIndex: (searchIndex: ExploreSearchIndex) => void;

  sortValue: string;
  onChangeSortValue: (sortValue: string) => void;

  sortOrder: string;
  onChangeSortOder: (sortOder: SORT_ORDER) => void;

  showDeleted: boolean;
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

export interface ExploreQuickFilterProps {
  index: SearchIndex;
  field: ExploreQuickFilterField;
  onFieldRemove: (value: string) => void;
  onFieldValueSelect: (field: ExploreQuickFilterField) => void;
}

export interface SearchInputProps {
  options: DefaultOptionType[];
  value: string | undefined;
  handleChange: (value: string) => void;
  handleSearch: (value: string) => void;
  handleSelect: (value: string) => void;
  handleClear: () => void;
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
  | DashboardDataModel;

export interface EntityDetailsObjectInterface {
  details: EntityUnion;
  entityType: string;
}
