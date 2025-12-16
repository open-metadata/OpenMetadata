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
    showErrorToast(t('message.entity-type-required'));

    return { success: false };
  }

  const currentData = { [fieldName]: currentValue };
  const updatedData = { [fieldName]: newValue };
  let jsonPatch = compare(currentData, updatedData);

  if (jsonPatch.length === 0) {
    return { success: true, data: currentValue };
  }

  const hasArrayIndexOperations = jsonPatch.some(
    (op) => (op.op === 'add' || op.op === 'remove') && op.path.match(/\/\d+$/)
  );

  if (Array.isArray(newValue) && hasArrayIndexOperations) {
    jsonPatch = [
      {
        op: 'replace',
        path: `/${fieldName}`,
        value: newValue,
      },
    ];
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
    showErrorToast(
      error as AxiosError,
      t('server.entity-updating-error', {
        entity: entityLabel.toLowerCase(),
      })
    );

    return { success: false };
  }
};
