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

import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/api/feed/createThread';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';

export interface EntityTasksProps {
  data: {
    fqn: string;
    field?: string | TagLabel[];
  };
  tagSource?: TagSource;
  entityFqn: string;
  entityType: EntityType;
  entityTaskType: EntityField.TAGS | EntityField.DESCRIPTION;
  onThreadLinkSelect: (value: string, threadType?: ThreadType) => void;
}
