import { AxiosResponse } from 'axios';
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
  paging?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields('/airflowPipeline', arrQueryFields)}${
    paging ? paging : ''
  }`;

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
