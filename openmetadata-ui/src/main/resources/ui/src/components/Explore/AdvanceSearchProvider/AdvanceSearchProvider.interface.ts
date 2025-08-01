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
import { Config, ImmutableTree } from '@react-awesome-query-builder/antd';
import { ReactNode } from 'react';
import { SearchIndex } from '../../../enums/search.enum';

export enum SearchOutputType {
  ElasticSearch = 'elasticsearch',
  JSONLogic = 'jsonlogic',
}

export interface AdvanceSearchProviderProps {
  children: ReactNode;
  isExplorePage?: boolean;
  modalProps?: {
    title?: string;
    subTitle?: string;
  };
  updateURL?: boolean;
  fieldOverrides?: { field: string; type: string }[];
  searchOutputType?: SearchOutputType;
  entityType?: string; // Optional entity type to filter custom properties
}

export interface AdvanceSearchContext {
  queryFilter?: Record<string, unknown>;
  sqlQuery: string;
  onTreeUpdate: (nTree: ImmutableTree, nConfig: Config) => void;
  toggleModal: (show: boolean) => void;
  treeInternal: ImmutableTree;
  config: Config;
  isUpdating: boolean;
  onReset: () => void;
  onResetAllFilters: () => void;
  onChangeSearchIndex: (index: SearchIndex | Array<SearchIndex>) => void;
  searchIndex: string | Array<string>;
  onSubmit: () => void;
  modalProps?: {
    title?: string;
    subTitle?: string;
  };
}

export interface CustomPropertyEnumConfig {
  multiSelect: boolean;
  values: string[];
}
