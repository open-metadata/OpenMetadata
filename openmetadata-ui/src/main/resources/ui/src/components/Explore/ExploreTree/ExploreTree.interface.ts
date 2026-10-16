/*
 *  Copyright 2024 Collate.
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
import { ReactNode } from 'react';
import { EntityFields } from '../../../enums/AdvancedSearch.enum';
import type { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { ExploreQuickFilterField } from '../ExplorePage.interface';

export type ExploreTreeNode = {
  title: ReactNode;
  key: string;
  children?: ExploreTreeNode[];
  isLeaf?: boolean;
  icon?: JSX.Element | SvgComponent | ReactNode;
  data?: TreeNodeData;
  count?: number;
  totalCount?: number;
  type?: string | null;
  tooltip?: string;
  disabled?: boolean;
};

export type ExploreTreeProps = {
  // Static governance leaves (Glossary/Tag/Metric…) still apply a plain quick
  // filter through this callback.
  onFieldValueSelect: (field: ExploreQuickFilterField[]) => void;
  // Hierarchical selections (category/serviceType/service/database/schema)
  // report the browse location; entity-type leaves additionally report the
  // type they refine to, so filters and location update in one navigation.
  onTreeSelect: (payload: {
    browseFields: ExploreQuickFilterField[];
    typeField?: ExploreQuickFilterField;
  }) => void;
  // Entity types selected in the Data Assets filter. Top-level categories that
  // cannot contain any of these types are grayed out and non-selectable.
  selectedEntityTypes?: string[];
  additionalQueryFilter?: QueryFilterInterface;
};

export type TreeNodeData = {
  isRoot?: boolean;
  isStatic?: boolean;
  currentBucketKey?: string;
  currentBucketValue?: string;
  filterField?: ExploreQuickFilterField[];
  parentSearchIndex?: string;
  rootIndex?: string;
  entityType?: string;
  dataId?: string;
  childEntities?: string[];
};

export type DatabaseFields =
  | EntityFields.SERVICE_TYPE
  | EntityFields.SERVICE
  | EntityFields.DATABASE_DISPLAY_NAME
  | EntityFields.DATABASE_SCHEMA_DISPLAY_NAME;
