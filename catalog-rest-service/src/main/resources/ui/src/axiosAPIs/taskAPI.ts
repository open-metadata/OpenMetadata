import { AxiosResponse } from 'axios';
import { Task } from '../generated/entity/data/pipeline';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTaskById: Function = (
  id: string,
  arrQueryFields: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/tasks/${id}`, arrQueryFields);

  return APIClient.get(url);
};

export const updateTask: Function = (
  id: string,
  data: Task
): Promise<AxiosResponse> => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  return APIClient.patch(`/tasks/${id}`, data, configOptions);
};
