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

import { EntityTags } from 'Models';
import { TagSource } from '../../../generated/type/tagLabel';

export interface TagsViewerProps {
  tags: EntityTags[];
  sizeCap?: number;
  displayType?: DisplayType;
  showNoDataPlaceholder?: boolean;
  tagType?: TagSource;
  newLook?: boolean;
}

export enum DisplayType {
  READ_MORE = 'read-more',
  POPOVER = 'popover',
}

export enum LayoutType {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}
