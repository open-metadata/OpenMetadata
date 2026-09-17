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
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Column } from '../../../generated/entity/data/table';
import { Conversation } from '../../../generated/entity/feed/conversation';
import { EntityReference } from '../../../generated/entity/type';
import { FeedCounts } from '../../../interface/feed.interface';
import { Task, TaskStatusGroup } from '../../../rest/tasksAPI';

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
  urlFqn?: string;
}

export type ActivityFeedTabProps = ActivityFeedTabBasicProps &
  (
    | {
        columns?: Column[];
        entityType: EntityType.TABLE;
      }
    | { columns?: undefined; entityType: Exclude<EntityType, EntityType.TABLE> }
  );

export interface ActivityFeedTabLeftPanelProps {
  activeTab?: ActivityFeedTabs;
  countData: FeedCounts;
  isTaskActiveTab: boolean;
  isUserEntity: boolean;
  layoutType?: ActivityFeedLayoutType;
  taskFilter: TaskStatusGroup;
  onTabChange: (subTab: string) => void;
}

/** Structurally compatible with antd's MenuItemType without importing it. */
export interface TaskFilterOption {
  key: TaskStatusGroup;
  label: ReactNode;
  onClick: () => void;
}

export interface TaskFilterBarProps {
  countData: FeedCounts;
  isMentionTabSelected: boolean;
  isVisible: boolean;
  taskFilter: TaskStatusGroup;
  taskFilterOptions: TaskFilterOption[];
  taskToggle: ReactNode;
}

export interface ActivityFeedTabListProps {
  activityEvents: ActivityEvent[];
  emptyPlaceholderText: ReactNode;
  entityThread: Conversation[];
  isActivityLoading?: boolean;
  isAllTab: boolean;
  isFirstLoad: boolean;
  isFullWidth: boolean;
  isTaskListTab: boolean;
  loading: boolean;
  selectedActivity?: ActivityEvent;
  selectedTask?: Task;
  selectedThread?: Conversation;
  tasks: Task[];
  onActivityClick: (activity: ActivityEvent) => void;
  onAfterClose: () => void;
  onFeedClick: (feed: Conversation) => void;
  onPanelResize: (isFullWidth: boolean) => void;
  onTaskClick: (task: Task) => void;
}

export interface ActivityFeedTabRightPanelProps {
  content: ReactNode;
  hasSelection: boolean;
  isFullWidth: boolean;
  layoutType?: ActivityFeedLayoutType;
  loader: ReactNode;
  loading: boolean;
  placeholder: ReactNode;
}
