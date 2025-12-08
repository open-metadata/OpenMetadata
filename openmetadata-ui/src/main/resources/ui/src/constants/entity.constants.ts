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

import { FeedCounts } from '../interface/feed.interface';
import { EntityField } from './Feeds.constants';

export const FEED_COUNT_INITIAL_DATA: FeedCounts = {
  conversationCount: 0,
  totalTasksCount: 0,
  openTaskCount: 0,
  closedTaskCount: 0,
  totalCount: 0,
  mentionCount: 0,
};

export const STEPS_FOR_IMPORT_ENTITY = [
  {
    name: 'label.upload-csv-uppercase-file',
    step: 1,
  },
  {
    name: 'label.preview-data',
    step: 2,
  },
];

export const ENTITY_TASKS_TOOLTIP = {
  [EntityField.DESCRIPTION]: {
    request: 'message.request-description',
    update: 'message.request-update-description',
  },
  [EntityField.TAGS]: {
    request: 'label.request-tag-plural',
    update: 'label.update-request-tag-plural',
  },
};
