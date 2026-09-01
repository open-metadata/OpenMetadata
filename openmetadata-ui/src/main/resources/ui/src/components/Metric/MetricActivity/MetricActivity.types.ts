/*
 *  Copyright 2026 Collate.
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
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../generated/entity/feed/conversation';
import { Task } from '../../../generated/entity/tasks/task';

export interface MetricMentionOption {
  displayName: string;
  fullyQualifiedName: string;
  id: string;
  type: string;
}

export interface MetricMentionQuery {
  denotation: '@' | '#';
  query: string;
  start: number;
}

export type MetricActivityTabKey = 'all' | 'mentions' | 'tasks';
export type MetricTaskStatusFilter = 'closed' | 'open';

export type MetricActivitySelection =
  | { kind: 'activity'; value: ActivityEvent }
  | { kind: 'task'; value: Task }
  | { kind: 'thread'; value: Conversation };

export type MetricActivityListItem =
  | { id: string; kind: 'activity'; timestamp: number; value: ActivityEvent }
  | { id: string; kind: 'thread'; timestamp: number; value: Conversation };
