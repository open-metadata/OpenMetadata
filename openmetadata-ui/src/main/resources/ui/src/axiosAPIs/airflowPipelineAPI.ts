import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { CreateAirflowPipeline } from '../generated/api/operations/pipelines/createAirflowPipeline';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

const operationsBaseUrl = '/api/operations/v1';

export const addAirflowPipeline = (
  data: CreateAirflowPipeline
): Promise<AxiosResponse> => {
  const url = '/airflowPipeline';

  return APIClient({
    method: 'post',
    url,
    baseURL: operationsBaseUrl,
    data: data,
  });
};

export const getAirflowPipelines = (
  arrQueryFields: Array<string>,
  serviceFilter?: string,
  extraFilter = '',
  paging?: string
): Promise<AxiosResponse> => {
  const service = serviceFilter ? `service=${serviceFilter}` : '';
  const url = `${getURLWithQueryFields(
    '/airflowPipeline',
    arrQueryFields,
    service
  )}${extraFilter ? extraFilter : ''}${paging ? paging : ''}`;

  return APIClient({ method: 'get', url, baseURL: operationsBaseUrl });
};

export const triggerAirflowPipelineById = (
  id: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(
    `/airflowPipeline/trigger/${id}`,
    arrQueryFields
  );

  return APIClient({ method: 'post', url, baseURL: operationsBaseUrl });
};

export const deleteAirflowPipelineById = (
  id: string,
  arrQueryFields = ''
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/airflowPipeline/${id}`, arrQueryFields);

  return APIClient({ method: 'delete', url, baseURL: operationsBaseUrl });
};

export const updateAirflowPipeline = (
  id: string,
  data: Operation[]
): Promise<AxiosResponse> => {
  const url = `/airflowPipeline/${id}`;

  return APIClient({
    method: 'patch',
    url,
    baseURL: operationsBaseUrl,
    data: data,
    headers: { 'Content-type': 'application/json-patch+json' },
  });
};
