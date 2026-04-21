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
import { AxiosResponse } from 'axios';
import { VotingDataProps } from 'components/Entity/Voting/voting.interface';
import { Operation } from 'fast-json-patch';
import { EntityReference } from 'generated/entity/type';
import { EntityHistory } from 'generated/type/entityHistory';
import { Include } from 'generated/type/include';
import { PagingResponse } from 'Models';
import APIClient from 'rest/index';
import {
  CreateKnowledgePage,
  KnowledgePage,
  KnowledgePageHierarchyResponse,
  KnowledgePagePutResponse,
  PageHierarchy,
  PageType,
} from '../interface/knowledge-center.interface';

export type ListParams = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
  pageType?: PageType;
  tagFQN?: string;
  entityType?: string;
  entityId?: string;
};

export interface KnowledgePageHierarchyParams {
  parent?: string;
  pageType?: PageType;
  offset: number;
  limit: number;
}

export const getListKnowledgePages = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<KnowledgePage[]>>(
    '/knowledgeCenter',
    { params }
  );

  return response.data;
};

export const getKnowledgePageByFqn = async (
  pageName: string,
  params?: ListParams
) => {
  const response = await APIClient.get<KnowledgePage>(
    `/knowledgeCenter/name/${pageName}`,
    {
      params,
    }
  );

  return response.data;
};

export const postKnowledgePage = async (data: CreateKnowledgePage) => {
  const response = await APIClient.post<
    CreateKnowledgePage,
    AxiosResponse<KnowledgePage>
  >('/knowledgeCenter', data);

  return response.data;
};

export const putKnowledgePage = async (data: CreateKnowledgePage) => {
  const response = await APIClient.put<
    CreateKnowledgePage,
    AxiosResponse<KnowledgePage>
  >('/knowledgeCenter', data);

  return response.data;
};

export const patchKnowledgePage = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<KnowledgePage>
  >(`/knowledgeCenter/${id}`, data, configOptions);

  return response.data;
};

export const updateKnowledgePageVote = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<KnowledgePagePutResponse>
  >(`/knowledgeCenter/${id}/vote`, data);

  return response.data;
};

export const followKnowledgePage = async (
  KnowledgePageId: string,
  userId: string
) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.put<
    string,
    AxiosResponse<{
      changeDescription: { fieldsAdded: { newValue: EntityReference[] }[] };
    }>
  >(`/knowledgeCenter/${KnowledgePageId}/followers`, userId, configOptions);

  return response.data;
};

export const unFollowKnowledgePage = async (
  KnowledgePageId: string,
  userId: string
) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  const response = await APIClient.delete<
    string,
    AxiosResponse<{
      changeDescription: {
        fieldsDeleted: { oldValue: EntityReference[] }[];
      };
    }>
  >(`/knowledgeCenter/${KnowledgePageId}/followers/${userId}`, configOptions);

  return response.data;
};

export const getKnowledgePageVersionsList = async (id: string) => {
  const url = `knowledgeCenter/${id}/versions`;
  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getKnowledgePageVersionData = async (
  id: string,
  version: string
) => {
  const url = `knowledgeCenter/${id}/versions/${version}`;
  const response = await APIClient.get<KnowledgePage>(url);

  return response.data;
};

export const getPageHierarchy = async (
  pageType: PageType = PageType.ARTICLE
) => {
  const url = `knowledgeCenter/hierarchy`;
  const response = await APIClient.get<PagingResponse<PageHierarchy[]>>(url, {
    params: { pageType },
  });

  return response.data;
};

export const getPageHierarchyFromES = async (
  parent?: string,
  pageType: PageType = PageType.ARTICLE,
  offset = 0,
  limit = 100,
  activeFqn?: string
) => {
  const url = `knowledgeCenter/search/hierarchy`;
  const response = await APIClient.get<KnowledgePageHierarchyResponse>(url, {
    params: { parent, pageType, offset, limit, activeFqn },
  });

  return response.data;
};
