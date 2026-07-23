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
import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import {
  CreateTask,
  TaskCategory,
  TaskPriority,
  TaskType,
} from '../generated/api/tasks/createTask';
import { ResolveTask } from '../generated/api/tasks/resolveTask';
import { TaskCount } from '../generated/api/tasks/taskCount';
import { Task, TaskStatus } from '../generated/entity/tasks/task';
import { Include } from '../generated/type/include';
import APIClient from './index';

export {
  TaskCategory,
  TaskPriority,
  TaskType as TaskEntityType,
} from '../generated/api/tasks/createTask';
export type { CreateTask } from '../generated/api/tasks/createTask';
export { ResolutionType as TaskResolutionType } from '../generated/api/tasks/resolveTask';
export type { ResolveTask } from '../generated/api/tasks/resolveTask';
export { TaskStatus as TaskEntityStatus } from '../generated/entity/tasks/task';
export type { Task, TaskComment } from '../generated/entity/tasks/task';
export type { GenericTaskPayload as TaskPayload } from '../generated/type/genericTaskPayload';

// Data access type enum - matches backend DataAccessType
export enum DataAccessType {
  FullAccess = 'FullAccess',
  ColumnLevel = 'ColumnLevel',
  Masked = 'Masked',
}

export enum DarWorkflowStage {
  Review = 'review',
  Approved = 'approved',
  Granted = 'granted',
}

const BASE_URL = '/tasks';

// 'Active' is a superset of 'Open' (Open/InProgress/Pending) that also includes
// Approved and Granted; used by the DAR hook so awaiting-grant and active-access
// requests are surfaced. 'Closed' keeps the legacy semantics that include
// Approved for non-DAR workflows where it is terminal.
export enum TaskStatusGroup {
  Open = 'open',
  Active = 'active',
  Closed = 'closed',
}
export type TaskCountView =
  | 'all'
  | 'visible'
  | 'assigned'
  | 'owned'
  | 'created'
  | 'mentioned'
  | 'entity';

interface TaskScopedListParams {
  fields?: string;
  status?: TaskStatus;
  statusGroup?: TaskStatusGroup;
  domain?: string;
  limit?: number;
  before?: string;
  after?: string;
  startTs?: number;
  endTs?: number;
  include?: Include;
}

export interface ListTasksParams {
  fields?: string;
  status?: TaskStatus;
  statusGroup?: TaskStatusGroup;
  category?: TaskCategory;
  type?: TaskType;
  domain?: string;
  priority?: TaskPriority;
  assignee?: string;
  createdBy?: string;
  createdById?: string;
  aboutEntity?: string;
  aboutService?: string;
  approver?: string;
  approverId?: string;
  mentionedUser?: string;
  limit?: number;
  before?: string;
  after?: string;
  startTs?: number;
  endTs?: number;
  include?: Include;
}

export interface ListDataAccessRequestsParams {
  fields?: string;
  status?: TaskStatus | TaskStatus[];
  statusGroup?: TaskStatusGroup;
  dataset?: string;
  service?: string;
  requestedBy?: string;
  requestedById?: string;
  approver?: string;
  approverId?: string;
  assignee?: string;
  accessType?: DataAccessType | DataAccessType[];
  domain?: string;
  q?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  include?: Include;
}

/**
 * Get a list of tasks with optional filters.
 */
export const listTasks = async (params?: ListTasksParams) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

/**
 * List Data Access Requests with DAR-specific filters and offset-based pagination.
 */
export const listDataAccessRequests = async (
  params?: ListDataAccessRequestsParams
) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/dataAccessRequests`,
    { params }
  );

  return response.data;
};

/**
 * Get tasks assigned to the current user or their teams.
 */
export const listMyAssignedTasks = async (params?: TaskScopedListParams) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/assigned`,
    { params }
  );

  return response.data;
};

/**
 * Get tasks for entities owned by the current user or their teams.
 */
export const listMyOwnedTasks = async (params?: TaskScopedListParams) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/owned`,
    { params }
  );

  return response.data;
};

/**
 * Get tasks visible to the current user.
 * Includes tasks assigned to the current user or their teams,
 * and tasks about entities owned by the current user or their teams.
 */
export const listMyVisibleTasks = async (params?: TaskScopedListParams) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/visible`,
    { params }
  );

  return response.data;
};

/**
 * Get tasks created by the current user.
 */
export const listMyCreatedTasks = async (params?: TaskScopedListParams) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/created`,
    { params }
  );

  return response.data;
};

/**
 * Get a task by its UUID.
 */
export const getTaskById = async (
  id: string,
  params?: { fields?: string; include?: Include }
): Promise<AxiosResponse<Task>> => {
  return APIClient.get<Task>(`${BASE_URL}/${id}`, { params });
};

/**
 * Get a task by its human-readable task ID (e.g., TASK-00001).
 */
export const getTaskByTaskId = async (
  taskId: string,
  params?: { fields?: string; include?: Include }
): Promise<AxiosResponse<Task>> => {
  return APIClient.get<Task>(`${BASE_URL}/name/${taskId}`, { params });
};

/**
 * Get all versions of a task.
 */
export const getTaskVersions = async (id: string) => {
  const response = await APIClient.get(`${BASE_URL}/${id}/versions`);

  return response.data;
};

/**
 * Get a specific version of a task.
 */
export const getTaskVersion = async (
  id: string,
  version: string
): Promise<AxiosResponse<Task>> => {
  return APIClient.get<Task>(`${BASE_URL}/${id}/versions/${version}`);
};

/**
 * Create a new task.
 */
export const createTask = async (data: CreateTask) => {
  const response = await APIClient.post<CreateTask, AxiosResponse<Task>>(
    BASE_URL,
    data
  );

  return response.data;
};

/**
 * Create or update a task.
 */
export const createOrUpdateTask = async (data: CreateTask) => {
  const response = await APIClient.put<CreateTask, AxiosResponse<Task>>(
    BASE_URL,
    data
  );

  return response.data;
};

/**
 * Update a task using JSON Patch operations.
 */
export const patchTask = async (id: string, data: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Task>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};

/**
 * Resolve a task (approve, reject, or complete).
 */
export const resolveTask = async (
  id: string,
  data: ResolveTask
): Promise<Task> => {
  const response = await APIClient.post<ResolveTask, AxiosResponse<Task>>(
    `${BASE_URL}/${id}/resolve`,
    data
  );

  return response.data;
};

/**
 * Close a task without resolution.
 */
export const closeTask = async (
  id: string,
  comment?: string
): Promise<Task> => {
  const response = await APIClient.post<unknown, AxiosResponse<Task>>(
    `${BASE_URL}/${id}/close`,
    {},
    { params: { comment } }
  );

  return response.data;
};

/**
 * Delete a task.
 */
export const deleteTask = async (
  id: string,
  hardDelete = false
): Promise<void> => {
  await APIClient.delete(`${BASE_URL}/${id}`, {
    params: { hardDelete },
  });
};

/**
 * Add a comment to a task.
 */
export const addTaskComment = async (
  id: string,
  message: string
): Promise<Task> => {
  const response = await APIClient.post<
    { message: string },
    AxiosResponse<Task>
  >(`${BASE_URL}/${id}/comments`, { message });

  return response.data;
};

/**
 * Edit a comment on a task.
 * Only the comment author can edit their own comment.
 */
export const editTaskComment = async (
  taskId: string,
  commentId: string,
  message: string
): Promise<Task> => {
  const response = await APIClient.patch<
    { message: string },
    AxiosResponse<Task>
  >(`${BASE_URL}/${taskId}/comments/${commentId}`, { message });

  return response.data;
};

/**
 * Delete a comment from a task.
 * The comment author or an admin can delete a comment.
 */
export const deleteTaskComment = async (
  taskId: string,
  commentId: string
): Promise<Task> => {
  const response = await APIClient.delete<Task>(
    `${BASE_URL}/${taskId}/comments/${commentId}`
  );

  return response.data;
};

/**
 * Get task counts by status.
 */
export const getTaskCounts = async (params?: {
  assignee?: string;
  createdBy?: string;
  aboutEntity?: string;
  mentionedUser?: string;
  view?: TaskCountView;
  domain?: string;
}): Promise<TaskCount> => {
  const response = await APIClient.get<TaskCount>(`${BASE_URL}/count`, {
    params,
  });

  return response.data;
};
