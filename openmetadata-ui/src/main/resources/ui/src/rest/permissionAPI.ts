/*
 *  Copyright 2022 Collate.
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

import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ResourcePermission } from '../generated/entity/policies/accessControl/resourcePermission';
import { Paging } from '../generated/type/paging';
import APIClient from './index';

export const getLoggedInUserPermissions = async () => {
  const params = {
    limit: 100,
  };
  const response = await APIClient.get<{
    data: ResourcePermission[];
    paging: Paging;
  }>('/permissions', { params });

  return response.data;
};

export const getEntityPermissionById = async (
  resource: ResourceEntity,
  entityId: string
) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}/${entityId}`
  );

  return response.data;
};
export const getEntityPermissionByFqn = async (
  resource: ResourceEntity,
  entityFqn: string
) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}/name/${entityFqn}`
  );

  return response.data;
};

export const getResourcePermission = async (resource: ResourceEntity) => {
  const response = await APIClient.get<ResourcePermission>(
    `/permissions/${resource}`
  );

  return response.data;
};
