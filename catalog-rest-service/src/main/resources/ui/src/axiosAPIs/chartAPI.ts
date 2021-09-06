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

export const updateChart: Function = (data: Chart): Promise<AxiosResponse> => {
  return APIClient.put('/charts/', data);
};
