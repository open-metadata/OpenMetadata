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
import { Category, CustomField } from '../generated/entity/type';
import { getURLWithQueryFields } from '../utils/APIUtils';
import APIClient from './index';

export const getTypeListByCategory = (
  category: Category
): Promise<AxiosResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set('category', category);
  searchParams.set('limit', '12');
  const path = getURLWithQueryFields(
    `/metadata/types`,
    '',
    searchParams.toString()
  );

  return APIClient.get(path);
};

export const getTypeByFQN = (typeFQN: string): Promise<AxiosResponse> => {
  const path = `/metadata/types/name/${typeFQN}`;

  return APIClient.get(path);
};

export const addFieldToEntity = (
  entityTypeId: string,
  data: CustomField
): Promise<AxiosResponse> => {
  const path = `/metadata/types/${entityTypeId}`;

  return APIClient.put(path, data);
};
