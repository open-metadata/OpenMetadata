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

import { SelectProps, TagProps } from 'antd';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { HighlightedTagLabel } from '../../Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';

export interface DataTestId {
  'data-testid'?: string;
}

export type TagsV1Props = {
  tag: TagLabel | HighlightedTagLabel;
  startWith: TAG_START_WITH;
  showOnlyName?: boolean;
  className?: string;
  isVersionPage?: boolean;
  tagProps?: TagProps & DataTestId;
  disabled?: boolean;
  tooltipOverride?: string;
  tagType?: TagSource;
  size?: SelectProps['size'];
  isEditTags?: boolean;
  newLook?: boolean;
};
