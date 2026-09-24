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

import { AxiosResponse, isAxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { EntityType, TabSpecificField } from '../enums/entity.enum';
import { Category, Type } from '../generated/entity/type';
import { CustomProperty } from '../generated/type/customProperty';
import { Paging } from '../generated/type/paging';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './axiosClient';
import { CustomPropertiesForAssets } from './metadataTypeAPI.interface';

export type FieldData = {
  name: string;
  type: string;
};

export const getTypeListByCategory = async (category: Category) => {
  const path = `/metadata/types`;

  const params = { category, limit: '20' };

  const response = await APIClient.get<{ data: Type[]; paging: Paging }>(path, {
    params,
  });

  return response.data;
};

export const getTypeByFQN = async (typeFQN: string) => {
  const path = `/metadata/types/name/${getEncodedFqn(typeFQN)}`;

  const params = { fields: TabSpecificField.CUSTOM_PROPERTIES };

  const response = await APIClient.get<Type>(path, { params });

  return response.data;
};

export const getAllCustomProperties = async () => {
  const path = `/metadata/types/customProperties`;
  const response = await APIClient.get<CustomPropertiesForAssets>(path);

  return response.data;
};

export const getCustomPropertiesByEntityType = async (entityType: string) => {
  const path = `/metadata/types/name/${getEncodedFqn(
    entityType
  )}/customProperties`;
  const response = await APIClient.get<CustomProperty[]>(path);

  return response.data;
};

export const addPropertyToEntity = async (
  entityTypeId: string,
  data: CustomProperty
) => {
  const path = `/metadata/types/${entityTypeId}`;

  const response = await APIClient.put<
    CustomProperty,
    AxiosResponse<CustomProperty>
  >(path, data);

  return response.data;
};

export const updateType = async (entityTypeId: string, data: Operation[]) => {
  const path = `/metadata/types/${entityTypeId}`;

  const response = await APIClient.patch<Operation[], AxiosResponse<Type>>(
    path,
    data
  );

  return response.data;
};

const MAX_CUSTOM_PROPERTY_DELETE_ATTEMPTS = 3;

/**
 * Removes one custom property by name. JSON Patch addresses array items by
 * index, and a type's custom properties are shared and edited concurrently, so
 * an index taken from an older copy can point past the end (400) or at a
 * different property (silently deleting it). The patch is therefore built from
 * a fresh copy and guarded by a `test` op on the name: if the list shifted in
 * between, the server rejects it and the patch is rebuilt.
 */
export const deleteCustomPropertyByName = async (
  typeFQN: string,
  propertyName: string
): Promise<Type> => {
  for (let attempt = 1; ; attempt++) {
    const type = await getTypeByFQN(typeFQN);
    const index = (type.customProperties ?? []).findIndex(
      (property) => property.name === propertyName
    );

    if (index === -1) {
      return type;
    }

    try {
      return await updateType(type.id ?? '', [
        {
          op: 'test',
          path: `/customProperties/${index}/name`,
          value: propertyName,
        },
        { op: 'remove', path: `/customProperties/${index}` },
      ]);
    } catch (error) {
      const isStaleIndex =
        isAxiosError(error) && error.response?.status === 400;

      if (!isStaleIndex || attempt >= MAX_CUSTOM_PROPERTY_DELETE_ATTEMPTS) {
        throw error;
      }
    }
  }
};

export const getFieldsForEntity = async (entityType: EntityType) => {
  const path = `/metadata/types/fields/${entityType}`;
  const response = await APIClient.get<FieldData[]>(path);

  return response.data;
};
