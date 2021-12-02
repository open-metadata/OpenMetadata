/*
 *  Copyright 2021 Collate
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

import { TagLabel } from '../../generated/type/tagLabel';

export type TagProps = {
  className?: string;
  editable?: boolean;
  type?: 'contained' | 'outlined' | 'label';
  startWith?: '#' | '+ ';
  tag: string | TagLabel;
  isRemovable?: boolean;
  removeTag?: (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
    removedTag: string
  ) => void;
};
