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

import { EntityTags } from 'Models';
import { ReactElement } from 'react';
import { ThreadType } from '../../../generated/api/feed/createThread';
import { TagSource } from '../../../generated/type/tagLabel';
import { DisplayType, LayoutType } from '../TagsViewer/TagsViewer.interface';

export type TagsContainerV2Props = {
  permission: boolean;
  showTaskHandler?: boolean;
  selectedTags: EntityTags[];
  entityType?: string;
  entityFqn?: string;
  tagType: TagSource;
  showHeader?: boolean;
  showBottomEditButton?: boolean;
  showInlineEditButton?: boolean;
  children?: ReactElement;
  displayType?: DisplayType;
  layoutType?: LayoutType;
  filterClassifications?: string[];
  onSelectionChange?: (selectedTags: EntityTags[]) => Promise<void>;
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
};
