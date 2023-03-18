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

import { TagLabel, TagSource } from 'generated/type/schema';
import { EntityTags, TagOption } from 'Models';
import { ReactNode } from 'react';
import { ThreadType } from '../../generated/api/feed/createThread';
import { Column, ColumnJoins, Table } from '../../generated/entity/data/table';
import { EntityFieldThreads } from '../../interface/feed.interface';

export interface EntityTableProps {
  tableColumns: Column[];
  joins: Array<ColumnJoins>;
  columnName: string;
  hasDescriptionEditAccess?: boolean;
  hasTagEditAccess?: boolean;
  tableConstraints: Table['tableConstraints'];
  searchText?: string;
  isReadOnly?: boolean;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  entityFieldTasks?: EntityFieldThreads[];
  onUpdate?: (columns: Column[]) => Promise<void>;
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  onEntityFieldSelect?: (value: string) => void;
}

export type TableCellRendered<T, K extends keyof T> = (
  value: T[K],
  record: T,
  index: number
) => ReactNode;

export interface DataTypeDisplayCellProps {
  dataTypeDisplay: Column['dataTypeDisplay'];
}

export interface EditColumnTag {
  column: Column;
  index: number;
}

export interface TagsCollection {
  Classification: TagOption[];
  Glossary: TagOption[];
}

export interface TableTagsProps {
  Classification: TagLabel[];
  Glossary: TagLabel[];
}

export interface EntityTableTagsProps {
  tags: TableTagsProps;
  allTags: TagOption[];
  onUpdateTagsHandler: (cell: Column) => void;
  isReadOnly?: boolean;
  entityFqn?: string;
  record: Column;
  index: number;
  isTagLoading: boolean;
  hasTagEditAccess?: boolean;
  handleTagSelection: (
    selectedTags?: Array<EntityTags>,
    columnFQN?: string,
    editColumnTag?: EditColumnTag,
    otherTags?: TagLabel[]
  ) => void;
  onRequestTagsHandler: (cell: Column) => void;
  getColumnName: (cell: Column) => string;
  entityFieldTasks?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  entityFieldThreads?: EntityFieldThreads[];
  tagFetchFailed: boolean;
  onUpdate?: (columns: Column[]) => Promise<void>;
  type: TagSource;
  fetchTags: () => void;
  dataTestId: string;
}
