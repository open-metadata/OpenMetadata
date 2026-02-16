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
import { EntityReference } from '../generated/entity/data/table';
import { Include } from '../generated/type/include';
import { TagLabel } from '../generated/type/tagLabel';
import APIClient from './index';

// Task status enum - matches backend TaskEntityStatus
export enum TaskEntityStatus {
  Open = 'Open',
  InProgress = 'InProgress',
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Failed = 'Failed',
}

// Task category enum - matches backend TaskCategory
export enum TaskCategory {
  Approval = 'Approval',
  DataAccess = 'DataAccess',
  MetadataUpdate = 'MetadataUpdate',
  Incident = 'Incident',
  Review = 'Review',
  Custom = 'Custom',
}

// Task type enum - matches backend TaskEntityType
export enum TaskEntityType {
  GlossaryApproval = 'GlossaryApproval',
  DataAccessRequest = 'DataAccessRequest',
  DescriptionUpdate = 'DescriptionUpdate',
  TagUpdate = 'TagUpdate',
  OwnershipUpdate = 'OwnershipUpdate',
  TierUpdate = 'TierUpdate',
  DomainUpdate = 'DomainUpdate',
  Suggestion = 'Suggestion',
  TestCaseResolution = 'TestCaseResolution',
  IncidentResolution = 'IncidentResolution',
  PipelineReview = 'PipelineReview',
  DataQualityReview = 'DataQualityReview',
  CustomTask = 'CustomTask',
}

// Task priority enum - matches backend TaskPriority
export enum TaskPriority {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

// Task resolution type enum
export enum TaskResolutionType {
  Approved = 'Approved',
  Rejected = 'Rejected',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  TimedOut = 'TimedOut',
  AutoApproved = 'AutoApproved',
  AutoRejected = 'AutoRejected',
}

// Task comment interface
export interface TaskComment {
  id: string;
  message: string;
  author: EntityReference;
  createdAt: number;
  reactions?: unknown[];
}

// Task resolution interface
export interface TaskResolution {
  type: TaskResolutionType;
  resolvedBy?: EntityReference;
  resolvedAt?: number;
  comment?: string;
  newValue?: string;
}

// Task payload interface for description/tag tasks
export interface TaskPayload {
  suggestedValue?: string;
  currentValue?: string;
  field?: string;
  fieldPath?: string;
  currentTags?: TagLabel[];
  tagsToAdd?: TagLabel[];
  tagsToRemove?: TagLabel[];
  operation?: string;
}

// Task entity interface - matches backend Task entity
export interface Task {
  id: string;
  taskId: string;
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
  description?: string;
  category: TaskCategory;
  type: TaskEntityType;
  status: TaskEntityStatus;
  priority: TaskPriority;
  about?: EntityReference;
  domain?: EntityReference;
  createdBy?: EntityReference;
  assignees?: EntityReference[];
  reviewers?: EntityReference[];
  watchers?: EntityReference[];
  payload?: TaskPayload;
  resolution?: TaskResolution;
  dueDate?: number;
  externalReference?: {
    system: string;
    externalId: string;
    externalUrl?: string;
    syncStatus?: string;
    lastSyncedAt?: number;
  };
  workflowInstanceId?: string;
  comments?: TaskComment[];
  commentCount?: number;
  tags?: TagLabel[];
  createdAt?: number;
  version?: number;
  updatedAt?: number;
  updatedBy?: string;
  href?: string;
  changeDescription?: unknown;
  deleted?: boolean;
}

// CreateTask request interface
export interface CreateTask {
  name: string;
  displayName?: string;
  description?: string;
  category: TaskCategory;
  type: TaskEntityType;
  priority?: TaskPriority;
  about?: string; // FQN of the entity this task is about
  aboutType?: string; // Type of the entity (e.g., "table", "dashboard")
  domain?: string;
  assignees?: string[]; // FQNs of users or teams
  reviewers?: string[]; // FQNs of users or teams
  payload?: TaskPayload;
  dueDate?: number;
  externalReference?: {
    system: string;
    externalId: string;
    externalUrl?: string;
  };
  tags?: TagLabel[];
}

// ResolveTask request interface
export interface ResolveTask {
  resolutionType: TaskResolutionType;
  comment?: string;
  newValue?: string;
}

const BASE_URL = '/tasks';

export type TaskStatusGroup = 'open' | 'closed';

export interface ListTasksParams {
  fields?: string;
  status?: TaskEntityStatus;
  statusGroup?: TaskStatusGroup;
  category?: TaskCategory;
  type?: TaskEntityType;
  domain?: string;
  priority?: TaskPriority;
  assignee?: string;
  createdBy?: string;
  aboutEntity?: string;
  mentionedUser?: string;
  limit?: number;
  before?: string;
  after?: string;
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
 * Get tasks assigned to the current user or their teams.
 */
export const listMyAssignedTasks = async (params?: {
  fields?: string;
  status?: TaskEntityStatus;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
}) => {
  const response = await APIClient.get<PagingResponse<Task[]>>(
    `${BASE_URL}/assigned`,
    { params }
  );

  return response.data;
};

/**
 * Get tasks created by the current user.
 */
export const listMyCreatedTasks = async (params?: {
  fields?: string;
  status?: TaskEntityStatus;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
}) => {
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
}) => {
  const response = await APIClient.get<{
    open: number;
    inProgress: number;
    completed: number;
    total: number;
  }>(`${BASE_URL}/count`, { params });

  return response.data;
};
