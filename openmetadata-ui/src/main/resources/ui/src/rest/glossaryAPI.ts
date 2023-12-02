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
import { VotingDataProps } from '../components/Voting/voting.interface';
import { CreateGlossary } from '../generated/api/data/createGlossary';
import { CreateGlossaryTerm } from '../generated/api/data/createGlossaryTerm';
import {
  EntityReference,
  Glossary,
  TagLabel,
} from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { CSVImportResult } from '../generated/type/csvImportResult';
import { EntityHistory } from '../generated/type/entityHistory';
import { ListParams } from '../interface/API.interface';
import { getURLWithQueryFields } from '../utils/APIUtils';
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

export const updateGlossaries = (
  data: CreateGlossary
): Promise<AxiosResponse> => {
  const url = '/glossaries';

  return APIClient.put(url, data);
};

export const patchGlossaries = async (id: string, patch: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<Glossary>>(
    `/glossaries/${id}`,
    patch,
    configOptions
  );

  return response.data;
};

export const getGlossariesByName = async (
  glossaryName: string,
  arrQueryFields: string | string[]
) => {
  const url = getURLWithQueryFields(
    `/glossaries/name/${glossaryName}`,
    arrQueryFields
  );

  const response = await APIClient.get<Glossary>(url);

  return response.data;
};

export const getGlossariesById = async (
  id: string,
  arrQueryFields?: string | string[]
) => {
  const url = getURLWithQueryFields(`/glossaries/${id}`, arrQueryFields);

  const response = await APIClient.get<Glossary>(url);

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

export const getGlossaryTermsById = async (
  glossaryTermId = '',
  arrQueryFields = ''
) => {
  const url = getURLWithQueryFields(
    `/glossaryTerms/${glossaryTermId}`,
    arrQueryFields
  );

  const response = await APIClient.get<GlossaryTerm>(url);

  return response.data;
};

export const getGlossaryTermByFQN = async (
  glossaryTermFQN = '',
  arrQueryFields: string | string[] = ''
) => {
  const url = getURLWithQueryFields(
    `/glossaryTerms/name/${encodeURIComponent(glossaryTermFQN)}`,
    arrQueryFields
  );

  const response = await APIClient.get<GlossaryTerm>(url);

  return response.data;
};

export const addGlossaryTerm = (
  data: CreateGlossaryTerm
): Promise<AxiosResponse> => {
  const url = '/glossaryTerms';

  return APIClient.post(url, data);
};

export const patchGlossaryTerm = async (id: string, patch: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<
    Operation[],
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}`, patch, configOptions);

  return response.data;
};

export const deleteGlossary = (id: string) => {
  return APIClient.delete(`/glossaries/${id}?recursive=true&hardDelete=true`);
};

export const deleteGlossaryTerm = (id: string) => {
  return APIClient.delete(
    `/glossaryTerms/${id}?recursive=true&hardDelete=true`
  );
};

export const exportGlossaryInCSVFormat = async (glossaryName: string) => {
  const response = await APIClient.get<string>(
    `/glossaries/name/${glossaryName}/export`
  );

  return response.data;
};

export const importGlossaryInCSVFormat = async (
  glossaryName: string,
  data: string,
  dryRun = true
) => {
  const configOptions = {
    headers: { 'Content-type': 'text/plain' },
  };
  const response = await APIClient.put<string, AxiosResponse<CSVImportResult>>(
    `/glossaries/name/${encodeURIComponent(
      glossaryName
    )}/import?dryRun=${dryRun}`,
    data,
    configOptions
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
    AxiosResponse<Glossary>
  >(`/glossaries/${id}/vote`, data);

  return response.data;
};

export const updateGlossaryTermVotes = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}/vote`, data);

  return response.data;
};

type AssetsData = {
  assets: EntityReference[];
  dryRun: boolean;
  glossaryTags: TagLabel[];
};

export const addAssetsToGlossaryTerm = async (
  glossaryTerm: GlossaryTerm,
  assets: EntityReference[]
) => {
  const data = {
    assets: assets,
    dryRun: false,
    glossaryTags: glossaryTerm.tags ?? [],
  };

  const response = await APIClient.put<AssetsData, AxiosResponse<GlossaryTerm>>(
    `/glossaryTerms/${glossaryTerm.id}/assets/add`,
    data
  );

  return response.data;
};
