/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { AxiosResponse } from 'axios';
import { TagCategory } from '../generated/entity/tags/tagCategory';
import { TagsCategory } from '../pages/tags/tagsTypes';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTags: Function = (
  arrQueryFields?: string
): Promise<AxiosResponse> => {
  const url = getURLWithQueryFields('/tags', arrQueryFields);

  return APIClient.get(url);
};

export const getCategory = async (
  name: string,
  arrQueryFields?: string | string[]
) => {
  const url = getURLWithQueryFields(`/tags/${name}`, arrQueryFields);

  const response = await APIClient.get<TagsCategory | TagCategory>(url);

  return response.data;
};

export const deleteTagCategory = (
  categoryId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/tags/${categoryId}`);
};

export const createTagCategory = async (data: TagsCategory) => {
  const response = await APIClient.post<
    TagsCategory,
    AxiosResponse<TagCategory>
  >('/tags', data);

  return response.data;
};
export const updateTagCategory = (name: string, data: TagsCategory) => {
  return APIClient.put(`/tags/${name}`, data);
};

export const createTag = (name: string, data: TagsCategory) => {
  return APIClient.post(`/tags/${name}`, data);
};

export const updateTag = (
  category: string,
  tagName: string,
  data: TagsCategory
) => {
  return APIClient.put(`/tags/${category}/${tagName}`, data);
};

export const deleteTag = (
  categoryName: string,
  tagId: string
): Promise<AxiosResponse> => {
  return APIClient.delete(`/tags/${categoryName}/${tagId}`);
};
