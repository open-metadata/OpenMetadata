import { AxiosResponse } from 'axios';
import { Chart } from '../generated/entity/data/chart';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getChartById: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/charts/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const updateChart: Function = (
  id: string,
  data: Chart
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/charts/${id}`, data, configOptions);
};
