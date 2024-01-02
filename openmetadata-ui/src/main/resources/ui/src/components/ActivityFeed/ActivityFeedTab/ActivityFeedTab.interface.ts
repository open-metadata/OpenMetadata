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
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';

export type FeedKeys = 'all' | 'mentions' | 'tasks';
export type TaskFilter = 'open' | 'close';

export enum ActivityFeedTabs {
  ALL = 'all',
  MENTIONS = 'mentions',
  TASKS = 'tasks',
}

export interface ActivityFeedTabBasicProps {
  fqn: string;
  isForFeedTab?: boolean;
  onFeedUpdate: () => void;
  onUpdateEntityDetails?: () => void;
  owner?: EntityReference;
}

export type ActivityFeedTabProps = ActivityFeedTabBasicProps &
  (
    | {
        columns?: Column[];
        entityType: EntityType.TABLE;
      }
    | { columns?: undefined; entityType: Exclude<EntityType, EntityType.TABLE> }
  );
