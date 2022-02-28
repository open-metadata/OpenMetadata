import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { CreateGlossary } from '../generated/api/data/createGlossary';
import { CreateGlossaryTerm } from '../generated/api/data/createGlossaryTerm';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getGlossaries: Function = (
  paging = '',
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/glossaries`, arrQueryFields);

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

export const getGlossariesByName: Function = (
  glossaryName: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/glossaries/name/${glossaryName}`,
    arrQueryFields
  );

  return APIClient.get(url);
};

export const getGlossaryTerms: Function = (
  glossaryId = '',
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const qParams = glossaryId ? `glossary=${glossaryId}` : '';
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

export const getGlossaryTermsByFQN: Function = (
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
