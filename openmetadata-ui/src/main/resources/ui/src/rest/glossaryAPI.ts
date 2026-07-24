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
import { GlossaryTermRelationGraph } from '../generated/api/data/glossaryTermRelationGraph';
import { OntologyStudioAsset } from '../generated/api/data/ontologyStudioAsset';
import { OntologyStudioDataGraph } from '../generated/api/data/ontologyStudioDataGraph';
import { OntologyStudioSummary } from '../generated/api/data/ontologyStudioSummary';
import { UpdateTermRelation } from '../generated/api/data/updateTermRelation';
import { MoveGlossaryTermRequest } from '../generated/api/tests/moveGlossaryTermRequest';
import { GlossaryTermRelationType } from '../generated/configuration/glossaryTermRelationSettings';
import { EntityReference, Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { ChangeEvent } from '../generated/type/changeEvent';
import { EntityHistory } from '../generated/type/entityHistory';
import { RelationshipTypeUsage } from '../generated/type/relationshipTypeUsage';
import { TermRelation } from '../generated/type/termRelation';
import { ListParams, ListParamsWithOffset } from '../interface/API.interface';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

export type ListGlossaryTermsParams = ListParams & {
  glossary?: string;
  parent?: string;
  entityStatus?: string;
};

export type SearchGlossaryTermsParams = ListParamsWithOffset & {
  q?: string;
  glossary?: string;
  glossaryFqn?: string;
  parent?: string;
  parentFqn?: string;
  entityStatus?: string;
};

const BASE_URL = '/glossaries';

export const getGlossariesList = async (
  params?: ListParams,
  signal?: AbortSignal
) => {
  const response = await APIClient.get<PagingResponse<Glossary[]>>(BASE_URL, {
    params,
    signal,
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

export const queryGlossaryTerms = async (
  glossaryName: string,
  signal?: AbortSignal
) => {
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
    signal,
  });

  return data;
};

export const getGlossaryTermsById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<GlossaryTerm>(`/glossaryTerms/${id}`, {
    params,
  });

  return response.data;
};

// Batch fetch up to 100 glossary terms by Id in a single round-trip.
// 100 matches the backend MAX_BATCH_BY_IDS cap — going higher would 400
// (or 431 once the URL clears Jetty's 8 KB header limit). Replaces the
// per-Id resolution N+1 inside the Relations Graph hook
// (useOntologyExplorer). Missing/unauthorized Ids are silently dropped
// by the backend, so callers should compare response length to input.
export const getGlossaryTermsByIds = async (
  ids: string[],
  params?: ListParams
): Promise<GlossaryTerm[]> => {
  if (ids.length === 0) {
    return [];
  }
  const response = await APIClient.get<GlossaryTerm[]>('/glossaryTerms/byIds', {
    params: {
      ...params,
      ids: ids.join(','),
    },
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

export const exportGlossaryTermsInCSVFormat = async (glossaryName: string) => {
  const response = await APIClient.get<CSVExportResponse>(
    `/glossaryTerms/name/${getEncodedFqn(glossaryName)}/exportAsync`
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

export const getGlossaryTermAssets = async (
  termId: string,
  limit = 100,
  offset = 0
) => {
  const response = await APIClient.get<PagingResponse<EntityReference[]>>(
    `/glossaryTerms/${termId}/assets`,
    { params: { limit, offset } }
  );

  return response.data;
};

export const getGlossaryTermsAssetCounts = async (
  parent?: string
): Promise<Record<string, number>> => {
  const response = await APIClient.get<Record<string, number>>(
    '/glossaryTerms/assets/counts',
    { params: parent ? { parent } : undefined }
  );

  return response.data;
};

export interface OntologyStudioPageParams {
  parent?: string;
  limit?: number;
  offset?: number;
}

export interface OntologyStudioDataParams extends OntologyStudioPageParams {
  assetPreviewSize?: number;
}

export const getOntologyStudioSummary = async (
  params?: OntologyStudioPageParams,
  signal?: AbortSignal
): Promise<OntologyStudioSummary> => {
  const response = await APIClient.get<OntologyStudioSummary>(
    '/glossaryTerms/studio/summary',
    { params, signal }
  );

  return response.data;
};

export const getOntologyStudioDataGraph = async (
  params?: OntologyStudioDataParams,
  signal?: AbortSignal
): Promise<OntologyStudioDataGraph> => {
  const response = await APIClient.get<OntologyStudioDataGraph>(
    '/glossaryTerms/studio/data',
    { params, signal }
  );

  return response.data;
};

export const getOntologyStudioAssets = async (
  termId: string,
  limit = 6,
  offset = 0,
  signal?: AbortSignal
): Promise<PagingResponse<OntologyStudioAsset[]>> => {
  const response = await APIClient.get<PagingResponse<OntologyStudioAsset[]>>(
    `/glossaryTerms/${termId}/studioAssets`,
    {
      params: { limit, offset },
      signal,
    }
  );

  return response.data;
};

export const searchGlossaryTerms = async (
  search: string,
  page = 1,
  signal?: AbortSignal
) => {
  const apiUrl = `/search/query?q=${search ?? ''}`;

  const { data } = await APIClient.get(apiUrl, {
    params: {
      index: SearchIndex.GLOSSARY_TERM,
      from: (page - 1) * PAGE_SIZE_MEDIUM,
      size: PAGE_SIZE_MEDIUM,
      deleted: false,
      track_total_hits: true,
      getHierarchy: true,
    },
    signal,
  });

  return data;
};

export const searchGlossaryTermsPaginated = async (
  params: SearchGlossaryTermsParams
) => {
  const response = await APIClient.get<PagingResponse<GlossaryTerm[]>>(
    '/glossaryTerms/search',
    { params }
  );

  return response.data;
};

export type GlossaryTermWithChildren = Omit<GlossaryTerm, 'children'> & {
  children?: GlossaryTerm[];
};

export const getFirstLevelGlossaryTermsPaginated = async (
  parentFQN: string,
  pageSize = 50,
  after?: string,
  entityStatus?: string
) => {
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
      limit: pageSize,
      after: after,
      entityStatus,
    },
  });

  return data;
};

export const getGlossaryTermChildrenLazy = async (
  parentFQN: string,
  limit = 50,
  after?: string
) => {
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
      limit,
      after,
    },
  });

  return data;
};

export const addTermRelation = async (
  termId: string,
  termRelation: TermRelation
): Promise<GlossaryTerm> => {
  const response = await APIClient.post<
    TermRelation,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${termId}/relations`, termRelation);

  return response.data;
};

export const removeTermRelation = async (
  termId: string,
  toTermId: string,
  relationType?: string
): Promise<GlossaryTerm> => {
  const params: Record<string, string> = {};
  if (relationType) {
    params.relationType = relationType;
  }
  const response = await APIClient.delete<GlossaryTerm>(
    `/glossaryTerms/${termId}/relations/${toTermId}`,
    { params }
  );

  return response.data;
};

export const updateTermRelation = async (
  termId: string,
  toTermId: string,
  termRelation: TermRelation
): Promise<GlossaryTerm> => {
  const response = await APIClient.put<
    TermRelation,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${termId}/relations/${toTermId}`, termRelation);

  return response.data;
};

export const removeTermRelationById = async (
  termId: string,
  relationshipId: string
): Promise<GlossaryTerm> => {
  const response = await APIClient.delete<GlossaryTerm>(
    `/glossaryTerms/${termId}/relations/id/${relationshipId}`
  );

  return response.data;
};

export const updateTermRelationById = async (
  termId: string,
  relationshipId: string,
  update: UpdateTermRelation
): Promise<GlossaryTerm> => {
  const response = await APIClient.put<
    UpdateTermRelation,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${termId}/relations/id/${relationshipId}`, update);

  return response.data;
};

export const getTermRelationGraph = async (
  termId: string,
  depth = 1,
  relationTypes?: string[]
): Promise<GlossaryTermRelationGraph> => {
  const params: Record<string, number | string> = { depth };
  if (relationTypes && relationTypes.length > 0) {
    params.relationTypes = relationTypes.join(',');
  }
  const response = await APIClient.get<GlossaryTermRelationGraph>(
    `/glossaryTerms/${termId}/relationsGraph`,
    { params }
  );

  return response.data;
};

export const getGlossaryTermRelationSettings = async () => {
  const response = await APIClient.get(
    '/system/settings/glossaryTermRelationSettings'
  );

  return response.data?.config_value;
};

const GLOSSARY_TERM_RELATION_TYPES_URL =
  '/system/settings/glossaryTermRelationSettings/relationTypes';

export const getGlossaryTermRelationTypes = async (
  params: ListParamsWithOffset
): Promise<PagingResponse<GlossaryTermRelationType[]>> => {
  const response = await APIClient.get<
    PagingResponse<GlossaryTermRelationType[]>
  >(GLOSSARY_TERM_RELATION_TYPES_URL, { params });

  return response.data;
};

export const createGlossaryTermRelationType = async (
  relationType: GlossaryTermRelationType
): Promise<GlossaryTermRelationType> => {
  const response = await APIClient.post<GlossaryTermRelationType>(
    GLOSSARY_TERM_RELATION_TYPES_URL,
    relationType
  );

  return response.data;
};

export const updateGlossaryTermRelationType = async (
  relationType: GlossaryTermRelationType
): Promise<GlossaryTermRelationType> => {
  const response = await APIClient.put<GlossaryTermRelationType>(
    `${GLOSSARY_TERM_RELATION_TYPES_URL}/${encodeURIComponent(
      relationType.name
    )}`,
    relationType
  );

  return response.data;
};

export const deleteGlossaryTermRelationType = async (
  relationTypeName: string
): Promise<void> => {
  await APIClient.delete(
    `${GLOSSARY_TERM_RELATION_TYPES_URL}/${encodeURIComponent(
      relationTypeName
    )}`
  );
};

export const updateGlossaryTermRelationSettings = async (settings: unknown) => {
  const response = await APIClient.put('/system/settings', {
    config_type: 'glossaryTermRelationSettings',
    config_value: settings,
  });

  return response.data;
};

export const getRelationTypeUsageCounts = async (): Promise<
  Record<string, number>
> => {
  const response = await APIClient.get<RelationshipTypeUsage[]>(
    '/glossaryTerms/relationTypes/usage'
  );

  return (response.data ?? []).reduce<Record<string, number>>(
    (counts, usage) => {
      if (usage.relationshipType?.name) {
        counts[usage.relationshipType.name] = usage.count ?? 0;
      }

      return counts;
    },
    {}
  );
};
