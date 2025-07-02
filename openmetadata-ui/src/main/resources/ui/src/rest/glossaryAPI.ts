/*
 *  Copyright 2022 Collate.
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
import { CSVExportResponse } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { VotingDataProps } from '../components/Entity/Voting/voting.interface';
import { MoveGlossaryTermWebsocketResponse } from '../components/Modals/ChangeParentHierarchy/ChangeParentHierarchy.interface';
import { ES_MAX_PAGE_SIZE, PAGE_SIZE_MEDIUM } from '../constants/constants';
import { TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { AddGlossaryToAssetsRequest } from '../generated/api/addGlossaryToAssetsRequest';
import { CreateGlossary } from '../generated/api/data/createGlossary';
import { CreateGlossaryTerm } from '../generated/api/data/createGlossaryTerm';
import { MoveGlossaryTermRequest } from '../generated/api/tests/moveGlossaryTermRequest';
import { EntityReference, Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { ChangeEvent } from '../generated/type/changeEvent';
import { EntityHistory } from '../generated/type/entityHistory';
import { ListParams } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringsUtils';
import APIClient from './index';

export type ListGlossaryTermsParams = ListParams & {
  glossary?: string;
  parent?: string;
};

const BASE_URL = '/glossaries';

export const getGlossariesList = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<Glossary[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const addGlossaries = async (data: CreateGlossary) => {
  const url = '/glossaries';

  const response = await APIClient.post<
    CreateGlossary,
    AxiosResponse<Glossary>
  >(url, data);

  return response.data;
};

export const patchGlossaries = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<Operation[], AxiosResponse<Glossary>>(
    `/glossaries/${id}`,
    patch
  );

  return response.data;
};

export const getGlossariesByName = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<Glossary>(
    `/glossaries/name/${getEncodedFqn(fqn)}`,
    {
      params,
    }
  );

  return response.data;
};

export const getGlossariesById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<Glossary>(`/glossaries/${id}`, {
    params,
  });

  return response.data;
};

export const getGlossaryTerms = async (params: ListGlossaryTermsParams) => {
  const response = await APIClient.get<PagingResponse<GlossaryTerm[]>>(
    '/glossaryTerms',
    {
      params,
    }
  );

  return response.data;
};

export const queryGlossaryTerms = async (glossaryName: string) => {
  const apiUrl = `/search/query`;

  const { data } = await APIClient.get(apiUrl, {
    params: {
      index: SearchIndex.GLOSSARY_TERM,
      q: '',
      from: 0,
      size: ES_MAX_PAGE_SIZE,
      deleted: false,
      track_total_hits: true,
      query_filter: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  'glossary.name.keyword': glossaryName.toLocaleLowerCase(),
                },
              },
            ],
          },
        },
      }),
      getHierarchy: true,
    },
  });

  return data;
};

export const getGlossaryTermsById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<GlossaryTerm>(`/glossaryTerms/${id}`, {
    params,
  });

  return response.data;
};

export const getGlossaryTermByFQN = async (fqn = '', params?: ListParams) => {
  const response = await APIClient.get<GlossaryTerm>(
    `/glossaryTerms/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export const addGlossaryTerm = async (
  data: CreateGlossaryTerm
): Promise<GlossaryTerm> => {
  const url = '/glossaryTerms';

  const response = await APIClient.post(url, data);

  return response.data;
};

export const patchGlossaryTerm = async (id: string, patch: Operation[]) => {
  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}`, patch);

  return response.data;
};

export const moveGlossaryTerm = async (id: string, parent: EntityReference) => {
  const response = await APIClient.put<
    MoveGlossaryTermRequest,
    AxiosResponse<MoveGlossaryTermWebsocketResponse>
  >(`/glossaryTerms/${id}/moveAsync`, {
    parent,
  });

  return response.data;
};

export const exportGlossaryInCSVFormat = async (glossaryName: string) => {
  const response = await APIClient.get<CSVExportResponse>(
    `/glossaries/name/${getEncodedFqn(glossaryName)}/exportAsync`
  );

  return response.data;
};

export const getGlossaryVersionsList = async (id: string) => {
  const url = `/glossaries/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getGlossaryVersion = async (id: string, version: string) => {
  const url = `/glossaries/${id}/versions/${version}`;
  const response = await APIClient.get<Glossary>(url);

  return response.data;
};

export const getGlossaryTermsVersionsList = async (id: string) => {
  const url = `/glossaryTerms/${id}/versions`;

  const response = await APIClient.get<EntityHistory>(url);

  return response.data;
};

export const getGlossaryTermsVersion = async (id: string, version: string) => {
  const url = `/glossaryTerms/${id}/versions/${version}`;

  const response = await APIClient.get<GlossaryTerm>(url);

  return response.data;
};

export const updateGlossaryVotes = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<ChangeEvent>
  >(`/glossaries/${id}/vote`, data);

  return response.data;
};

export const updateGlossaryTermVotes = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<ChangeEvent>
  >(`/glossaryTerms/${id}/vote`, data);

  return response.data;
};

export const validateTagAddtionToGlossary = async (
  glossaryTerm: GlossaryTerm,
  dryRun = false
) => {
  const data = {
    dryRun: dryRun,
    glossaryTags: glossaryTerm.tags ?? [],
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<BulkOperationResult>
  >(`/glossaryTerms/${glossaryTerm.id}/tags/validate`, data);

  return response.data;
};

export const addAssetsToGlossaryTerm = async (
  glossaryTerm: GlossaryTerm,
  assets: EntityReference[],
  dryRun = false
) => {
  const data = {
    assets: assets,
    dryRun: dryRun,
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${glossaryTerm.id}/assets/add`, data);

  return response.data;
};

export const removeAssetsFromGlossaryTerm = async (
  glossaryTerm: GlossaryTerm,
  assets: EntityReference[]
) => {
  const data = {
    assets: assets,
    dryRun: false,
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${glossaryTerm.id}/assets/remove`, data);

  return response.data;
};

export const searchGlossaryTerms = async (search: string, page = 1) => {
  const apiUrl = `/search/query?q=*${search ?? ''}*`;

  const { data } = await APIClient.get(apiUrl, {
    params: {
      index: SearchIndex.GLOSSARY_TERM,
      from: (page - 1) * PAGE_SIZE_MEDIUM,
      size: PAGE_SIZE_MEDIUM,
      deleted: false,
      track_total_hits: true,
      getHierarchy: true,
    },
  });

  return data;
};

export type GlossaryTermWithChildren = Omit<GlossaryTerm, 'children'> & {
  children?: GlossaryTerm[];
};

export const getFirstLevelGlossaryTerms = async (parentFQN: string) => {
  const apiUrl = `/glossaryTerms`;

  const { data } = await APIClient.get<
    PagingResponse<GlossaryTermWithChildren[]>
  >(apiUrl, {
    params: {
      directChildrenOf: parentFQN,
      fields: [
        TabSpecificField.CHILDREN_COUNT,
        TabSpecificField.OWNERS,
        TabSpecificField.REVIEWERS,
      ],
      limit: 100000,
    },
  });

  return data;
};
