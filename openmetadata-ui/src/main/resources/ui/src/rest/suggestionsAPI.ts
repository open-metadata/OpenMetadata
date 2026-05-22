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
import { PagingResponse } from 'Models';
import { SuggestionAction } from '../components/Suggestions/SuggestionsProvider/SuggestionsProvider.interface';
import { TagLabel } from '../generated/type/tagLabel';
import { ListParams } from '../interface/API.interface';
import {
  Suggestion,
  SuggestionStatus,
  SuggestionType,
} from '../types/taskSuggestion';
import EntityLink from '../utils/EntityLink';
import APIClient from './index';
import {
  resolveTask,
  Task,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from './tasksAPI';

const TASKS_BASE_URL = '/tasks';

export type ListSuggestionsParams = ListParams & {
  entityFQN?: string;
  limit?: number;
  userId?: string;
};

const mapTaskStatusToSuggestionStatus = (
  status: TaskEntityStatus
): SuggestionStatus => {
  switch (status) {
    case TaskEntityStatus.Open:
    case TaskEntityStatus.InProgress:
    case TaskEntityStatus.Pending:
      return SuggestionStatus.Open;
    case TaskEntityStatus.Completed:
    case TaskEntityStatus.Approved:
      return SuggestionStatus.Accepted;
    case TaskEntityStatus.Rejected:
    case TaskEntityStatus.Cancelled:
    case TaskEntityStatus.Failed:
      return SuggestionStatus.Rejected;
    default:
      return SuggestionStatus.Open;
  }
};

const mapSuggestionTypeFromPayload = (
  payload?: Record<string, unknown>
): SuggestionType | undefined => {
  const suggestionType = payload?.suggestionType as string | undefined;
  if (suggestionType === 'Description') {
    return SuggestionType.SuggestDescription;
  }
  if (suggestionType === 'Tag') {
    return SuggestionType.SuggestTagLabel;
  }

  return undefined;
};

const buildEntityLink = (task: Task): string => {
  const entityType = task.about?.type ?? '';
  const entityFQN = task.about?.fullyQualifiedName ?? '';
  const fieldPath = (task.payload?.fieldPath ?? task.payload?.field) as
    | string
    | undefined;

  if (fieldPath) {
    return EntityLink.getEntityLink(entityType, entityFQN, fieldPath);
  }

  return EntityLink.getEntityLink(entityType, entityFQN);
};

const taskToSuggestion = (task: Task): Suggestion => {
  const payload = task.payload;

  return {
    id: task.id,
    entityLink: buildEntityLink(task),
    type: mapSuggestionTypeFromPayload(
      payload as Record<string, unknown> | undefined
    ),
    status: mapTaskStatusToSuggestionStatus(task.status),
    description: (payload?.newDescription ?? payload?.suggestedValue) as
      | string
      | undefined,
    tagLabels: (payload?.tagsToAdd as TagLabel[] | undefined) ?? undefined,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    updatedBy: task.updatedBy,
  };
};

export const getSuggestionsList = async (
  params?: ListSuggestionsParams
): Promise<PagingResponse<Suggestion[]>> => {
  const response = await APIClient.get<PagingResponse<Task[]>>(TASKS_BASE_URL, {
    params: {
      aboutEntity: params?.entityFQN,
      type: TaskEntityType.Suggestion,
      status: TaskEntityStatus.Open,
      limit: params?.limit,
      before: params?.before,
      after: params?.after,
      fields: 'about,payload,createdBy',
    },
  });

  return {
    data: response.data.data.map(taskToSuggestion),
    paging: response.data.paging,
  };
};

export const getSuggestionsByUserId = async (
  userId: string,
  params?: Omit<ListSuggestionsParams, 'userId'>
): Promise<PagingResponse<Suggestion[]>> => {
  const response = await APIClient.get<PagingResponse<Task[]>>(TASKS_BASE_URL, {
    params: {
      aboutEntity: params?.entityFQN,
      type: TaskEntityType.Suggestion,
      status: TaskEntityStatus.Open,
      createdBy: userId,
      limit: params?.limit,
      before: params?.before,
      after: params?.after,
      fields: 'about,payload,createdBy',
    },
  });

  return {
    data: response.data.data.map(taskToSuggestion),
    paging: response.data.paging,
  };
};

export const updateSuggestionStatus = async (
  data: Suggestion,
  action: SuggestionAction
): Promise<AxiosResponse> => {
  const resolutionType =
    action === SuggestionAction.Accept
      ? TaskResolutionType.Approved
      : TaskResolutionType.Rejected;

  const newValue =
    data.type === SuggestionType.SuggestDescription
      ? data.description
      : data.tagLabels
      ? JSON.stringify(data.tagLabels)
      : undefined;

  const result = await resolveTask(data.id, {
    resolutionType,
    newValue,
  });

  return { data: result } as AxiosResponse;
};

export const approveRejectAllSuggestions = async (
  userId: string,
  entityFQN: string,
  _suggestionType: SuggestionType,
  action: SuggestionAction
): Promise<AxiosResponse> => {
  const response = await APIClient.get<PagingResponse<Task[]>>(TASKS_BASE_URL, {
    params: {
      aboutEntity: entityFQN,
      type: TaskEntityType.Suggestion,
      status: TaskEntityStatus.Open,
      createdBy: userId,
      limit: 100,
      fields: 'about,payload,createdBy',
    },
  });

  const resolutionType =
    action === SuggestionAction.Accept
      ? TaskResolutionType.Approved
      : TaskResolutionType.Rejected;

  const promises = response.data.data.map((task) => {
    const suggestion = taskToSuggestion(task);
    const newValue =
      suggestion.type === SuggestionType.SuggestDescription
        ? suggestion.description
        : suggestion.tagLabels
        ? JSON.stringify(suggestion.tagLabels)
        : undefined;

    return resolveTask(task.id, { resolutionType, newValue });
  });

  await Promise.allSettled(promises);

  return { data: {} } as AxiosResponse;
};
