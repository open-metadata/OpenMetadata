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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { TFunction } from 'i18next';
import { EntityType } from '../enums/entity.enum';
import entityUtilClassBase from './EntityUtilClassBase';
import { validateEntityId } from './EntityValidationUtils';
import { showErrorToast, showSuccessToast } from './ToastUtils';

interface UpdateEntityFieldOptions<T> {
  entityId: string | undefined;
  entityType: EntityType | undefined;
  fieldName: string;
  currentValue: T;
  newValue: T;
  entityLabel: string;
  onSuccess?: (value: T) => void;
  t: TFunction;
}

interface UpdateEntityFieldResult<T> {
  success: boolean;
  data?: T;
}

export const getEffectiveUpdateKey = <T extends object>(
  key: keyof T | undefined,
  updatedEntity: T
): keyof T | undefined => {
  return (
    key ||
    ('extension' in updatedEntity && updatedEntity.extension === undefined
      ? ('extension' as keyof T)
      : undefined)
  );
};

export const mergeEntityStateUpdate = <T extends object>(
  previous: T,
  response: Partial<T>,
  updatedEntity: T,
  effectiveKey?: keyof T
): T => {
  if (effectiveKey && updatedEntity[effectiveKey] === undefined) {
    const { [effectiveKey]: _, ...restFromPrevious } = previous;
    const { [effectiveKey]: __, ...restFromResponse } = response;

    return { ...restFromPrevious, ...restFromResponse } as T;
  }

  const merged = { ...previous, ...response } as T;

  if (effectiveKey) {
    if (effectiveKey in response && response[effectiveKey] !== undefined) {
      merged[effectiveKey] = response[effectiveKey] as T[keyof T];
    } else {
      merged[effectiveKey] = updatedEntity[effectiveKey];
    }
  }

  return merged;
};

export const updateEntityField = async <T>({
  entityId,
  entityType,
  fieldName,
  currentValue,
  newValue,
  entityLabel,
  onSuccess,
  t,
}: UpdateEntityFieldOptions<T>): Promise<UpdateEntityFieldResult<T>> => {
  if (!validateEntityId(entityId, t)) {
    return { success: false };
  }

  if (!entityType) {
    // If onSuccess callback is provided, call it directly to allow custom handling
    if (onSuccess) {
      onSuccess(newValue);

      return { success: true, data: newValue };
    }
    showErrorToast(t('message.entity-type-required'));

    return { success: false };
  }

  const currentData = { [fieldName]: currentValue };
  const updatedData = { [fieldName]: newValue };
  const jsonPatch = compare(currentData, updatedData);

  if (jsonPatch.length === 0) {
    return { success: true, data: currentValue };
  }

  try {
    const patchAPI = entityUtilClassBase.getEntityPatchAPI(entityType);
    await patchAPI(entityId, jsonPatch);

    showSuccessToast(
      t('server.update-entity-success', { entity: entityLabel })
    );

    if (onSuccess) {
      onSuccess(newValue);
    }

    return { success: true, data: newValue };
  } catch (error) {
    // If patch API is not available but onSuccess callback is provided, use custom handling
    if (
      error instanceof Error &&
      error.message.includes('No patch API available') &&
      onSuccess
    ) {
      onSuccess(newValue);

      return { success: true, data: newValue };
    }

    showErrorToast(
      error as AxiosError,
      t('server.entity-updating-error', {
        entity: entityLabel.toLowerCase(),
      })
    );

    return { success: false };
  }
};
