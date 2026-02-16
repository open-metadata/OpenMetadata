/*
 *  Copyright 2024 Collate.
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
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../generated/type/paging';
import {
  CreateTask,
  ListTasksParams,
  ResolveTask,
  Task,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';

export interface TaskProviderProps {
  children: React.ReactNode;
}

export interface TaskProviderContextType {
  tasks: Task[];
  selectedTask: Task | undefined;
  loading: boolean;
  isCommentsLoading: boolean;
  isTestCaseResolutionLoading: boolean;
  testCaseResolutionStatus: TestCaseResolutionStatus[];
  paging: Paging;
  // Task CRUD operations
  fetchTasks: (params?: ListTasksParams) => Promise<void>;
  fetchMyAssignedTasks: (status?: TaskEntityStatus) => Promise<void>;
  fetchMyCreatedTasks: (status?: TaskEntityStatus) => Promise<void>;
  fetchTaskById: (id: string) => Promise<Task | undefined>;
  createNewTask: (task: CreateTask) => Promise<Task | undefined>;
  updateTask: (id: string, patch: Operation[]) => Promise<Task | undefined>;
  resolveTaskById: (id: string, data: ResolveTask) => Promise<Task | undefined>;
  closeTaskById: (id: string, comment?: string) => Promise<Task | undefined>;
  addComment: (taskId: string, message: string) => Promise<Task | undefined>;
  // Selection and state
  setSelectedTask: (task: Task | undefined) => void;
  refreshTask: (id: string) => Promise<void>;
  updateTestCaseIncidentStatus: (status: TestCaseResolutionStatus[]) => void;
}
