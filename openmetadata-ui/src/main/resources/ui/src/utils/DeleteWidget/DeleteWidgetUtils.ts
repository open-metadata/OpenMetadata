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
import { EntityType } from '../../enums/entity.enum';
import { deleteEntity } from '../../rest/miscAPI';
import i18n from '../i18next/LocalUtil';
import { showErrorToast, showSuccessToast } from '../ToastUtils';
import deleteWidgetClassBase from './DeleteWidgetClassBase';

export interface HardDeleteEntityOptions {
  isRecursiveDelete?: boolean;
  prepareType?: boolean;
  successMessage?: string;
}

/**
 * Permanently (hard) deletes an entity and surfaces the standard success/error
 * toasts. Mirrors the non-async delete path of `DeleteEntityModal` so call sites
 * that only ever hard-delete can use the lightweight `DeleteModal` confirmation
 * instead of the soft/hard `DeleteEntityModal`.
 *
 * @returns `true` when the entity was deleted, `false` otherwise.
 */
export const hardDeleteEntity = async (
  entityName: string,
  entityId: string,
  entityType: EntityType,
  {
    isRecursiveDelete = false,
    prepareType = true,
    successMessage,
  }: HardDeleteEntityOptions = {}
): Promise<boolean> => {
  let isSuccess = false;

  try {
    const response = await deleteEntity(
      prepareType
        ? deleteWidgetClassBase.prepareEntityType(entityType)
        : entityType,
      entityId,
      isRecursiveDelete,
      true
    );

    if (response.status === 200) {
      showSuccessToast(
        successMessage ??
          i18n.t('server.entity-deleted-successfully', { entity: entityName })
      );
      isSuccess = true;
    } else {
      showErrorToast(i18n.t('server.unexpected-response'));
    }
  } catch (error) {
    showErrorToast(
      error as AxiosError,
      i18n.t('server.delete-entity-error', { entity: entityName })
    );
  }

  return isSuccess;
};
