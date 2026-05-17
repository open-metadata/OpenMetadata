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
import { Include } from '../generated/type/include';
import APIClient from './index';

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

export const resolveTaskFormSchema = async (
  taskType: string,
  taskCategory?: string
) => {
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
