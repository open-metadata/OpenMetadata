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
import { Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import axiosClient from '.';
import { CreatePersona } from '../generated/api/teams/createPersona';
import { Persona } from '../generated/entity/teams/persona';
import { EntityHistory } from '../generated/type/entityHistory';
import {
  CacheState,
  ContextRule,
  PersonaContextDefinition,
} from '../generated/type/personaContextDefinition';
import { getEncodedFqn } from '../utils/StringUtils';

const BASE_URL = '/personas';

interface GetPersonasParams {
  fields?: string | string[];
  limit?: number;
  before?: string;
  after?: string;
}

export const getAllPersonas = async (params: GetPersonasParams) => {
  const response = await axiosClient.get<PagingResponse<Persona[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const searchPersonas = async (
  query: string,
  limit = 25
): Promise<Persona[]> => {
  const response = await axiosClient.get<PagingResponse<Persona[]>>(
    `${BASE_URL}/search`,
    {
      params: {
        q: query || undefined,
        limit,
        offset: 0,
      },
    }
  );

  return response.data.data;
};

export const getPersonaByName = async (fqn: string, fields?: string) => {
  const response = await axiosClient.get<Persona>(
    `${BASE_URL}/name/${getEncodedFqn(fqn)}`,
    {
      params: {
        fields: fields ?? 'users,contextDefinition',
      },
    }
  );

  return response.data;
};

export interface PersonaContextRulePreview {
  matchedCount: number;
  sampleNames: string[];
}

export interface PersonaContextDocument {
  bytes: number;
  cacheState: CacheState;
  entitiesIncluded: number;
  generatedAt: number;
  markdown: string;
  tokensEst: number;
  truncated: boolean;
  truncatedCount: number;
}

export const getPersonaAIContext = async (id: string) => {
  const response = await axiosClient.get<PersonaContextDefinition>(
    `${BASE_URL}/${id}/aiContext`
  );

  return response.data;
};

export const updatePersonaAIContext = async (
  id: string,
  data: Pick<
    PersonaContextDefinition,
    'cacheTtlMinutes' | 'characterBudget' | 'enabled'
  >
) => {
  const response = await axiosClient.put<PersonaContextDefinition>(
    `${BASE_URL}/${id}/aiContext`,
    data
  );

  return response.data;
};

export const createPersonaAIContextRule = async (
  id: string,
  rule: ContextRule
) => {
  const response = await axiosClient.post<PersonaContextDefinition>(
    `${BASE_URL}/${id}/aiContext/rules`,
    rule
  );

  return response.data;
};

export const updatePersonaAIContextRule = async (
  id: string,
  ruleId: string,
  rule: ContextRule
) => {
  const response = await axiosClient.put<PersonaContextDefinition>(
    `${BASE_URL}/${id}/aiContext/rules/${ruleId}`,
    rule
  );

  return response.data;
};

export const deletePersonaAIContextRule = async (
  id: string,
  ruleId: string
) => {
  const response = await axiosClient.delete<PersonaContextDefinition>(
    `${BASE_URL}/${id}/aiContext/rules/${ruleId}`
  );

  return response.data;
};

export const previewPersonaAIContextRule = async (
  id: string,
  rule: ContextRule
) => {
  const response = await axiosClient.post<PersonaContextRulePreview>(
    `${BASE_URL}/${id}/aiContext/rules/preview`,
    rule
  );

  return response.data;
};

export const getPersonaAIContextDocument = async (id: string) => {
  const response = await axiosClient.get<PersonaContextDocument>(
    `${BASE_URL}/${id}/aiContext/document`
  );

  return response.data;
};

export const refreshPersonaAIContextDocument = async (id: string) => {
  const response = await axiosClient.post<PersonaContextDocument>(
    `${BASE_URL}/${id}/aiContext/document:refresh`
  );

  return response.data;
};

export const createPersona = async (data: CreatePersona) => {
  const response = await axiosClient.post<
    CreatePersona,
    AxiosResponse<Persona>
  >(BASE_URL, data);

  return response.data;
};

export const updatePersona = async (id: string, data: Operation[]) => {
  const response = await axiosClient.patch<Operation[], AxiosResponse<Persona>>(
    `${BASE_URL}/${id}`,
    data
  );

  return response.data;
};

export const getPersonaVersions = async (id: string) => {
  const response = await axiosClient.get<EntityHistory>(
    `${BASE_URL}/${id}/versions`
  );

  return response.data;
};
