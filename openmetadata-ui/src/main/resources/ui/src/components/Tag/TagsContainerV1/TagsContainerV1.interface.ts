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

import { ThreadType } from 'generated/api/feed/createThread';
import { Tag } from 'generated/entity/classification/tag';
import { TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreads } from 'interface/feed.interface';
import { EntityTags } from 'Models';

interface TagsTreeProps {
  title: string;
  value: string;
  key: string;
  selectable: boolean;
}

export interface HierarchyTagsProps extends TagsTreeProps {
  children: TagsTreeProps[];
}

export type TagDetailsProps = {
  isLoading: boolean;
  options: {
    name: string;
    fqn: string;
    classification: Tag['classification'];
    source: TagSource;
  }[];
  isError: boolean;
};

export type TagsContainerV1Props = {
  editable: boolean;
  selectedTags: Array<EntityTags>;
  onSelectionChange: (selectedTags: Array<EntityTags>) => void;
  placeholder?: string;
  showLimited?: boolean;
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  entityType?: string;
  entityFieldThreads?: EntityFieldThreads[];
  entityFieldTasks?: EntityFieldThreads[];
  entityFqn?: string;
};
