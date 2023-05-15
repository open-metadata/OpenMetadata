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

import { Field } from 'generated/entity/data/topic';
import { TagLabel, TagSource } from 'generated/type/tagLabel';
import { EntityTags, TagOption } from 'Models';
import { ChartType } from 'pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { ThreadType } from '../../generated/api/feed/createThread';
import { Column } from '../../generated/entity/data/table';
import { EntityFieldThreads } from '../../interface/feed.interface';

export interface TableTagsComponentProps<T> {
  tags: TableTagsProps;
  tagList: TagOption[];
  onUpdateTagsHandler?: (cell: T) => void;
  isReadOnly?: boolean;
  entityFqn?: string;
  record: T;
  index: number;
  isTagLoading: boolean;
  hasTagEditAccess?: boolean;
  handleTagSelection: (
    selectedTags: Array<EntityTags>,
    editColumnTag: T,
    otherTags: TagLabel[]
  ) => void;
  onRequestTagsHandler?: (cell: T) => void;
  getColumnName?: (cell: T) => string;
  getColumnFieldFQN?: string;
  entityFieldTasks?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  entityFieldThreads?: EntityFieldThreads[];
  tagFetchFailed: boolean;
  type: TagSource;
  fetchTags: () => void;
  dataTestId: string;
}

export interface TagsCollection {
  Classification: TagOption[];
  Glossary: TagOption[];
}

export interface TableTagsProps {
  Classification: TagLabel[];
  Glossary: TagLabel[];
}

export type TableUnion = Column | Field | ChartType;
