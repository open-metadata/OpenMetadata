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
import { Operation } from 'fast-json-patch';
import { EntityType } from '../../../enums/entity.enum';
import { FeedFilter } from '../../../enums/mydata.enum';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../generated/type/paging';
import { ReactionType } from '../../../generated/type/reaction';
import { ListActivityParams } from '../../../rest/activityAPI';
import { Task, TaskStatusGroup } from '../../../rest/tasksAPI';

export interface ActivityFeedProviderContextType {
  loading: boolean;
  isActivityLoading?: boolean;
  isPostsLoading?: boolean;
  isTestCaseResolutionLoading?: boolean;
  // For activity events (entity changes)
  activityEvents: ActivityEvent[];
  selectedActivity: ActivityEvent | undefined;
  activityReplies: ConversationReply[];
  entityThread: Conversation[];
  selectedThread: Conversation | undefined;
  // For tasks - using Task type directly
  tasks: Task[];
  selectedTask: Task | undefined;
  isDrawerOpen: boolean;
  focusReplyEditor: boolean;
  entityPaging: Paging;
  setActiveThread: (thread?: Conversation) => void;
  setActiveTask: (task?: Task) => void;
  setActiveActivity: (activity?: ActivityEvent) => void;
  updateEntityThread: (thread: Conversation) => void;
  updateTask: (task: Task) => void;
  userId: string;
  deleteFeed: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => Promise<void>;
  postFeed: (value: string, id: string, isTask?: boolean) => Promise<void>;
  postActivityComment: (
    message: string,
    activity: ActivityEvent
  ) => Promise<void>;
  fetchUpdatedThread: (id: string, isTask?: boolean) => Promise<void>;
  updateFeed: (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => void;
  refreshActivityFeed: (threads: Conversation[]) => void;
  getFeedData: (
    filterType?: FeedFilter,
    after?: string,
    entityType?: EntityType,
    fqn?: string,
    limit?: number
  ) => Promise<void>;
  getTaskData: (
    filterType?: FeedFilter,
    after?: string,
    entityType?: EntityType,
    fqn?: string,
    taskStatusGroup?: TaskStatusGroup,
    limit?: number
  ) => Promise<void>;
  showDrawer: (thread: Conversation) => void;
  showTaskDrawer: (task: Task) => void;
  showActivityDrawer: (activity: ActivityEvent) => void;
  hideDrawer: () => void;
  updateEditorFocus: (isFocused: boolean) => void;
  updateReactions: (
    post: Conversation | ConversationReply,
    feedId: string,
    isThread: boolean,
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => Promise<void>;
  testCaseResolutionStatus: TestCaseResolutionStatus[];
  updateTestCaseIncidentStatus: (status: TestCaseResolutionStatus[]) => void;
  // Activity events methods
  fetchActivityEvents: (params?: ListActivityParams) => Promise<void>;
  fetchMyActivityFeed: (params?: {
    days?: number;
    limit?: number;
  }) => Promise<void>;
  fetchFollowingActivity: (params?: {
    days?: number;
    limit?: number;
  }) => Promise<void>;
  fetchEntityActivity: (
    entityType: string,
    fqn: string,
    params?: { days?: number; limit?: number }
  ) => Promise<void>;
  fetchUserActivity: (
    userId: string,
    params?: { days?: number; limit?: number }
  ) => Promise<void>;
  updateActivityReaction: (
    activityId: string,
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => Promise<void>;
}
