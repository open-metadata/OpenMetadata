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
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export interface LearningResource {
  id: string;
  name: string;
  fullyQualifiedName?: string;
  displayName?: string;
  description?: string;
  resourceType: 'Storylane' | 'Video' | 'Article';
  categories: Array<
    | 'Discovery'
    | 'Administration'
    | 'DataGovernance'
    | 'DataQuality'
    | 'Observability'
  >;
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  source: {
    provider?: string;
    url: string;
    embedConfig?: Record<string, unknown>;
  };
  estimatedDuration?: number;
  contexts: Array<{
    pageId: string;
    componentId?: string;
    priority?: number;
  }>;
  status?: 'Draft' | 'Active' | 'Deprecated';
  tags?: unknown[];
  owners?: unknown[];
  reviewers?: unknown[];
  followers?: unknown[];
  version?: number;
  updatedAt?: number;
  updatedBy?: string;
  href?: string;
  deleted?: boolean;
}

export interface CreateLearningResource {
  name: string;
  displayName?: string;
  description?: string;
  resourceType: 'Storylane' | 'Video' | 'Article';
  categories: Array<
    | 'Discovery'
    | 'Administration'
    | 'DataGovernance'
    | 'DataQuality'
    | 'Observability'
  >;
  difficulty?: 'Intro' | 'Intermediate' | 'Advanced';
  source: {
    provider?: string;
    url: string;
    embedConfig?: Record<string, unknown>;
  };
  estimatedDuration?: number;
  contexts: Array<{
    pageId: string;
    componentId?: string;
    priority?: number;
  }>;
  status?: 'Draft' | 'Active' | 'Deprecated';
  owners?: unknown[];
  reviewers?: unknown[];
  tags?: unknown[];
}

export type ListLearningResourcesParams = ListParams & {
  search?: string;
  pageId?: string | string[];
  componentId?: string | string[];
  category?: string | string[];
  resourceType?: string | string[];
  difficulty?: string;
  status?: string | string[];
};

const BASE_URL = '/learning/resources';

export const getLearningResourcesList = async (
  params?: ListLearningResourcesParams,
  config?: { signal?: AbortSignal }
) => {
  const response = await APIClient.get<PagingResponse<LearningResource[]>>(
    BASE_URL,
    { params, signal: config?.signal }
  );

  return response.data;
};

export const getLearningResourceById = async (
  id: string,
  params?: ListParams
) => {
  const response = await APIClient.get<LearningResource>(`${BASE_URL}/${id}`, {
    params,
  });

  return response.data;
};

export const getLearningResourceByName = async (
  fqn: string,
  params?: ListParams
) => {
  const response = await APIClient.get<LearningResource>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export const createLearningResource = async (data: CreateLearningResource) => {
  const response = await APIClient.post<
    CreateLearningResource,
    AxiosResponse<LearningResource>
  >(BASE_URL, data);

  return response.data;
};

export const updateLearningResource = async (data: CreateLearningResource) => {
  // PUT without ID does create-or-update by name
  const response = await APIClient.put<
    CreateLearningResource,
    AxiosResponse<LearningResource>
  >(BASE_URL, data);

  return response.data;
};

export const patchLearningResource = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<LearningResource>
  >(`${BASE_URL}/${id}`, patch);

  return response.data;
};

export const deleteLearningResource = async (
  id: string,
  hardDelete = false
) => {
  const response = await APIClient.delete<LearningResource>(
    `${BASE_URL}/${id}`,
    {
      params: { hardDelete },
    }
  );

  return response.data;
};

export const restoreLearningResource = async (id: string) => {
  const response = await APIClient.put<void, AxiosResponse<LearningResource>>(
    `${BASE_URL}/restore`,
    {
      id,
    }
  );

  return response.data;
};

export const getLearningResourcesByContext = async (
  pageId: string,
  params?: ListParams
) => {
  return getLearningResourcesList({
    ...params,
    pageId,
    status: 'Active',
  });
};
