import { AxiosResponse } from 'axios';
import { getCurrentUserId } from '../utils/CommonUtils';
import APIClient from './index';

export const searchData: Function = (
  queryString: string,
  from: number,
  size: number,
  filters: string
): Promise<AxiosResponse> => {
  const start = (from - 1) * size;
  const query = queryString ? `*${queryString}*` : '*';

  return APIClient.get(
    `/search/query?q=${query}${
      filters ? ` AND ${filters}` : ''
    }&from=${start}&size=${size}`
  );
};

export const getOwnershipCount: Function = (
  ownership: string
): Promise<AxiosResponse> => {
  return APIClient.get(
    `/search/query?q=${ownership}:${getCurrentUserId()}&from=${0}&size=${0}`
  );
};

export const fetchAuthorizerConfig: Function = (): Promise<AxiosResponse> => {
  return APIClient.get('/config/auth');
};

export const getSuggestions: Function = (
  queryString: string
): Promise<AxiosResponse> => {
  return APIClient.get(`/search/suggest?q=${queryString}`);
};
