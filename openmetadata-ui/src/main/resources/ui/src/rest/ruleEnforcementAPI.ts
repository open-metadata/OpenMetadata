/*
 *  Copyright 2025 Collate.
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
import { EntityRule } from '../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityType } from '../enums/entity.enum';
import APIClient from './index';

const BASE_URL = '/system/settings/entityRulesSettings';

export const getEntityRules = async (entityType: EntityType | string) => {
  const response = await APIClient.get<EntityRule[]>(
    `${BASE_URL}/${entityType.toLowerCase()}`
  );

  return response.data;
};

export const getAllEntityRules = async (): Promise<
  AxiosResponse<Record<string, EntityRule[]>>
> => {
  const response = await APIClient.get<Record<string, EntityRule[]>>(BASE_URL);

  return response;
};

export const updateEntityRules = async (
  entityType: EntityType | string,
  rules: EntityRule[]
) => {
  const response = await APIClient.put<EntityRule[]>(
    `${BASE_URL}/${entityType.toLowerCase()}`,
    rules
  );

  return response.data;
};
