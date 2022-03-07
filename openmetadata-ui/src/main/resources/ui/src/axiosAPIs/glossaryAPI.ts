/*
 *  Copyright 2021 Collate
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
import { CreateGlossary } from '../generated/api/data/createGlossary';
import { CreateGlossaryTerm } from '../generated/api/data/createGlossaryTerm';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getGlossaries: Function = (
  paging = '',
  limit = 10,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const qParams = `limit=${limit}`;
  const url = getURLWithQueryFields(`/glossaries`, arrQueryFields, qParams);

  return APIClient.get(paging ? `${url}&${paging}` : url);
};

export const addGlossaries = (data: CreateGlossary): Promise<AxiosResponse> => {
  const url = '/glossaries';

  return APIClient.post(url, data);
};

export const updateGlossaries = (
  data: CreateGlossary
): Promise<AxiosResponse> => {
  const url = '/glossaries';

  return APIClient.put(url, data);
};

export const patchGlossaries = (
  id: string,
  patch: Operation[]
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/glossaries/${id}`, patch, configOptions);
};

export const getGlossariesByName = (
  glossaryName: string,
  arrQueryFields: string | string[]
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/glossaries/name/${glossaryName}`,
    arrQueryFields
  );

  return APIClient.get(url);
};

export const getGlossaryTerms: Function = (
  glossaryId = '',
  limit = 10,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  let qParams = `limit=${limit}`;
  qParams += glossaryId ? `&glossary=${glossaryId}` : '';
  const url = getURLWithQueryFields(`/glossaryTerms`, arrQueryFields, qParams);

  return APIClient.get(url);
};

export const getGlossaryTermsById: Function = (
  glossaryTermId = '',
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/glossaryTerms/${glossaryTermId}`,
    arrQueryFields
  );

  return APIClient.get(url);
};

export const getGlossaryTermByFQN: Function = (
  glossaryTermFQN = '',
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/glossaryTerms/name/${glossaryTermFQN}`,
    arrQueryFields
  );

  return APIClient.get(url);
};

export const addGlossaryTerm = (
  data: CreateGlossaryTerm
): Promise<AxiosResponse> => {
  const url = '/glossaryTerms';

  return APIClient.post(url, data);
};

export const patchGlossaryTerm = (
  id: string,
  patch: Operation[]
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/glossaryTerms/${id}`, patch, configOptions);
};

export const deleteGlossary = (id: string) => {
  return APIClient.delete(`/glossaries/${id}`);
};

export const deleteGlossaryTerm = (id: string) => {
  return APIClient.delete(`/glossaryTerms/${id}`);
};
