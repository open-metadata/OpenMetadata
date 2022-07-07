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

import { EntityFieldThreads } from 'Models';
import { Table } from '../../../generated/entity/data/table';
import { ThreadType } from '../../../generated/entity/feed/thread';

export interface DescriptionProps {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  blurWithBodyBG?: boolean;
  removeBlur?: boolean;
  description?: string;
  isEdit?: boolean;
  isReadOnly?: boolean;
  entityType?: string;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  entityFieldTasks?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => void;
  onSuggest?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
}
