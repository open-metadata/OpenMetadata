import { AxiosResponse } from 'axios';
import { Table } from 'Models';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTableDetails: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/tables/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const getTableDetailsByFQN: Function = (
  fqn: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/tables/name/${fqn}`, arrQueryFields);

  return APIClient.get(url);
};

export const getAllTables: Function = (
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/tables', arrQueryFields);

  return APIClient.get(url);
};

export const getDatabaseTables: Function = (
  databaseName: string,
  paging: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = `${getURLWithQueryFields(
    `/tables`,
    arrQueryFields
  )}&database=${databaseName}${paging ? paging : ''}`;

  return APIClient.get(url);
};

export const patchTableDetails: Function = (
  id: string,
  data: Table
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/tables/${id}`, data, configOptions);
};

export const addFollower: Function = (
  tableId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.put(`/tables/${tableId}/followers`, userId, configOptions);
};

export const removeFollower: Function = (
  tableId: string,
  userId: string
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json' },
  };

  return APIClient.delete(
    `/tables/${tableId}/followers/${userId}`,
    configOptions
  );
};
