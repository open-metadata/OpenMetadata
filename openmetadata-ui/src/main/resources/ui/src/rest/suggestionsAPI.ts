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
import { SuggestionAction } from '../enums/Suggestion.enum';
import { TagLabel } from '../generated/type/tagLabel';
import { ListParams } from '../interface/API.interface';
import {
  Suggestion,
  SuggestionStatus,
  SuggestionType,
} from '../types/taskSuggestion';
import EntityLink from '../utils/EntityLink';
import { ENTITY_LINK_SEPARATOR } from '../utils/EntityPureUtils';
import Fqn from '../utils/Fqn';
import { parseTaskFieldPath } from '../utils/TaskFieldPathUtils';
import APIClient from './axiosClient';
import {
  resolveTask,
  Task,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from './tasksAPI';

const TASKS_BASE_URL = '/tasks';

const SUGGESTION_FIELDS = 'about,payload,createdBy';

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
  const fieldPath = parseTaskFieldPath(
    task.payload?.fieldPath as string | undefined
  );

  // An entity link names a field as <container>::<name path>, without the
  // property; a path to the entity itself has no field part.
  return fieldPath?.container
    ? EntityLink.getEntityLink(
        entityType,
        entityFQN,
        `${fieldPath.container}${ENTITY_LINK_SEPARATOR}${Fqn.build(
          ...fieldPath.names
        )}`
      )
    : EntityLink.getEntityLink(entityType, entityFQN);
};

const getTaskCreatedBy = (task: Task): Task['createdBy'] | undefined => {
  if (task.createdBy?.id) {
    return task.createdBy;
  }

  if (task.createdById) {
    return {
      id: task.createdById,
      name: task.updatedBy ?? task.createdById,
      type: 'user',
    };
  }

  return undefined;
};

// Suggestion producers send the proposed tags as a JSON string in suggestedValue.
const parseSuggestedTags = (value: unknown): TagLabel[] | undefined => {
  try {
    const tags = JSON.parse(value as string);

    return Array.isArray(tags) ? tags : undefined;
  } catch {
    return undefined;
  }
};

const taskToSuggestion = (task: Task): Suggestion => {
  const payload = task.payload;
  const type = mapSuggestionTypeFromPayload(
    payload as Record<string, unknown> | undefined
  );

  return {
    id: task.id,
    entityLink: buildEntityLink(task),
    type,
    status: mapTaskStatusToSuggestionStatus(task.status),
    description: (payload?.newDescription ?? payload?.suggestedValue) as
      | string
      | undefined,
    tagLabels:
      (payload?.tagsToAdd as TagLabel[] | undefined) ??
      (type === SuggestionType.SuggestTagLabel
        ? parseSuggestedTags(payload?.suggestedValue)
        : undefined),
    createdBy: getTaskCreatedBy(task),
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
      fields: SUGGESTION_FIELDS,
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
      createdById: userId,
      limit: params?.limit,
      before: params?.before,
      after: params?.after,
      fields: SUGGESTION_FIELDS,
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

  const tagLabelsValue = data.tagLabels
    ? JSON.stringify(data.tagLabels)
    : undefined;
  const newValue =
    data.type === SuggestionType.SuggestDescription
      ? data.description
      : tagLabelsValue;

  const result = await resolveTask(data.id, {
    resolutionType,
    newValue,
  });

  return { data: result } as AxiosResponse;
};

export const approveRejectAllSuggestions = async (
  userId: string,
  entityFQN: string,
  suggestionType: SuggestionType,
  action: SuggestionAction
): Promise<AxiosResponse> => {
  const response = await APIClient.get<PagingResponse<Task[]>>(TASKS_BASE_URL, {
    params: {
      aboutEntity: entityFQN,
      type: TaskEntityType.Suggestion,
      status: TaskEntityStatus.Open,
      createdById: userId,
      limit: 100,
      fields: SUGGESTION_FIELDS,
    },
  });

  const resolutionType =
    action === SuggestionAction.Accept
      ? TaskResolutionType.Approved
      : TaskResolutionType.Rejected;

  const filteredTasks = response.data.data.filter(
    (task) =>
      mapSuggestionTypeFromPayload(
        task.payload as Record<string, unknown> | undefined
      ) === suggestionType
  );

  // Resolve sequentially to avoid optimistic-lock version conflicts on the entity.
  for (const task of filteredTasks) {
    const suggestion = taskToSuggestion(task);
    const tagLabelsValue = suggestion.tagLabels
      ? JSON.stringify(suggestion.tagLabels)
      : undefined;
    const newValue =
      suggestion.type === SuggestionType.SuggestDescription
        ? suggestion.description
        : tagLabelsValue;

    // Mirror Promise.allSettled behavior: one failure must not block remaining tasks.
    await resolveTask(task.id, { resolutionType, newValue }).catch(
      () => undefined
    );
  }

  return { data: {} } as AxiosResponse;
};
