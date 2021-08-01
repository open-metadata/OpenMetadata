import { AxiosResponse } from 'axios';
import { Database } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getDatabases: Function = (
  serviceName: string,
  paging: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/databases`,
    arrQueryFields
  )}&service=${serviceName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const getTables: Function = (id: number): Promise<AxiosResponse> => {
  return APIClient.get('/databases/' + id + '/tables');
};

export const getDatabase: Function = (
  id: string,
  query?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/databases/${id}`, query);

  return APIClient.get(url);
};

export const getDatabaseDetailsByFQN: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/databases/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const patchDatabaseDetails: Function = (
  id: string,
  data: Database
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/databases/${id}`, data, configOptions);
};
