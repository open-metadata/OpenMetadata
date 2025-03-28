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
import { FeedCounts } from '../../../interface/feed.interface';

export type TaskFilter = 'open' | 'close';

export enum ActivityFeedTabs {
  ALL = 'all',
  MENTIONS = 'mentions',
  TASKS = 'tasks',
}

export enum ActivityFeedLayoutType {
  TWO_PANEL = 'TWO_PANEL',
  THREE_PANEL = 'THREE_PANEL',
}

export interface ActivityFeedTabBasicProps {
  isForFeedTab?: boolean;
  refetchFeed?: boolean;
  entityFeedTotalCount?: number;
  hasGlossaryReviewer?: boolean;
  onUpdateFeedCount?: (feedCount: FeedCounts) => void;
  onFeedUpdate: () => void;
  onUpdateEntityDetails?: () => void;
  owners?: EntityReference[];
  subTab?: ActivityFeedTabs;
  layoutType?: ActivityFeedLayoutType;
  feedCount?: FeedCounts;
}

export type ActivityFeedTabProps = ActivityFeedTabBasicProps &
  (
    | {
        columns?: Column[];
        entityType: EntityType.TABLE;
      }
    | { columns?: undefined; entityType: Exclude<EntityType, EntityType.TABLE> }
  );
