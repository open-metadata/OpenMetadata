import { AxiosResponse } from 'axios';
import { TagsCategory } from '../pages/tags/tagsTypes';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTags: Function = (
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/tags', arrQueryFields);

  return APIClient.get(url);
};

export const getCategory: Function = (
  name: string,
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields(`/tags/${name}`, arrQueryFields);

  return APIClient.get(url);
};

export const createTagCategory: Function = (data: TagsCategory) => {
  return APIClient.post('/tags', data);
};
export const updateTagCategory: Function = (
  name: string,
  data: TagsCategory
) => {
  return APIClient.put(`/tags/${name}`, data);
};

export const createTag: Function = (name: string, data: TagsCategory) => {
  return APIClient.post(`/tags/${name}`, data);
};

export const updateTag: Function = (
  category: string,
  tagName: string,
  data: TagsCategory
) => {
  return APIClient.put(`/tags/${category}/${tagName}`, data);
};
