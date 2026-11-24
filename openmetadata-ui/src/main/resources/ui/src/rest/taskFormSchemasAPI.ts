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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { PagingResponse } from 'Models';
import { TaskType } from '../generated/api/tasks/createTask';
import { Include } from '../generated/type/include';
import APIClient from './axiosClient';

const BASE_URL = '/taskFormSchemas';

export interface JsonSchemaObject {
  [key: string]:
    | string
    | number
    | boolean
    | JsonSchemaObject
    | JsonSchemaObject[]
    | string[];
}

export interface TaskFormSchema {
  id?: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
  description?: string;
  taskType: string;
  taskCategory?: string;
  formSchema: JsonSchemaObject;
  uiSchema?: JsonSchemaObject;
  workflowDefinitionRef?: string;
  workflowVersion?: number;
  createFormSchema?: JsonSchemaObject;
  createUiSchema?: JsonSchemaObject;
  transitionForms?: Record<string, JsonSchemaObject>;
  defaultStageMappings?: Record<string, string>;
  version?: number;
  updatedBy?: string;
  updatedAt?: number;
  href?: string;
  deleted?: boolean;
}

export interface ListTaskFormSchemaParams {
  fields?: string;
  taskType?: string;
  taskCategory?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
}

export const listTaskFormSchemas = async (
  params?: ListTaskFormSchemaParams
) => {
  const response = await APIClient.get<PagingResponse<TaskFormSchema[]>>(
    BASE_URL,
    {
      params,
    }
  );

  return response.data;
};

export const getTaskFormSchemaById = async (id: string) => {
  const response = await APIClient.get<TaskFormSchema>(`${BASE_URL}/${id}`);

  return response.data;
};

export const getTaskFormSchemaByFqn = async (fqn: string) => {
  const response = await APIClient.get<TaskFormSchema>(
    `${BASE_URL}/name/${fqn}`
  );

  return response.data;
};

/**
 * Payload-based mapping for the two seeded Suggestion schemas, mirroring the
 * backend's `TaskFormSchemaRepository#mapSuggestionTypeToSchema`. The backend
 * normalizes with `toLowerCase(Locale.ROOT)`, so this lookup is also
 * case-insensitive. The UI's `SuggestionsAPI` uses `'Description'`/`'Tag'`
 * (capitalized) on the wire; the migration util writes the same values into
 * `payload.suggestionType`, so we lower-case before comparing.
 */
const SUGGESTION_SCHEMA_BY_TYPE: Record<string, string> = {
  description: 'DescriptionSuggestion',
  tag: 'TagSuggestion',
};

export const getSuggestionSchemaName = (
  payload?: Record<string, unknown> | null
): string | undefined => {
  const suggestionType = payload?.suggestionType;

  if (typeof suggestionType !== 'string') {
    return undefined;
  }

  const normalized = suggestionType.trim().toLowerCase();

  return SUGGESTION_SCHEMA_BY_TYPE[normalized];
};

export const resolveTaskFormSchema = async (
  taskType: string,
  taskCategory?: string,
  payload?: Record<string, unknown> | null
) => {
  // Suggestion tasks reuse one taskType+taskCategory binding for two distinct
  // seeded schemas (DescriptionSuggestion, TagSuggestion), so a `limit: 1`
  // list query deterministically picks the lexicographically smaller name
  // (DescriptionSuggestion) regardless of the variant. Disambiguate by the
  // same signal the backend uses (`payload.suggestionType`), fetching the
  // matching schema by its FQN; fall back to the ambiguous list query for
  // every other path so non-Suggestion types keep their unique-binding flow.
  if (taskType === TaskType.Suggestion) {
    const suggestionSchemaName = getSuggestionSchemaName(payload);

    if (suggestionSchemaName) {
      try {
        return await getTaskFormSchemaByFqn(suggestionSchemaName);
      } catch {
        // Schema may be deleted or not yet seeded; fall through to list query.
      }
    }
  }

  const response = await listTaskFormSchemas({
    taskType,
    taskCategory,
    limit: 1,
  });

  return response.data?.[0];
};

export const createTaskFormSchema = async (data: TaskFormSchema) => {
  const response = await APIClient.post<TaskFormSchema>(BASE_URL, data);

  return response.data;
};

export const updateTaskFormSchema = async (data: TaskFormSchema) => {
  const response = await APIClient.put<TaskFormSchema>(BASE_URL, data);

  return response.data;
};
