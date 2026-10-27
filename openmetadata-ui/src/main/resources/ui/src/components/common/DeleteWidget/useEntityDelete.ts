/*
 *  Copyright 2026 Collate.
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
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { EntityType } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { deleteEntity } from '../../../rest/miscAPI';
import deleteWidgetClassBase from '../../../utils/DeleteWidget/DeleteWidgetClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import { DeleteType, DeleteWidgetModalProps } from './DeleteWidget.interface';

export type UseEntityDeleteOptions = Pick<
  DeleteWidgetModalProps,
  | 'entityName'
  | 'entityType'
  | 'entityId'
  | 'prepareType'
  | 'isAsyncDelete'
  | 'isRecursiveDelete'
  | 'successMessage'
  | 'afterDeleteAction'
>;

/**
 * The delete request behind `DeleteEntityPopover`: sync or async delete,
 * toasts, logging out when users delete themselves, and `afterDeleteAction`.
 * Errors are toasted here; the promise resolves to whether the delete
 * succeeded, so a confirmation popover stays open on failure.
 */
export const useEntityDelete = ({
  entityName,
  entityType,
  entityId,
  prepareType = true,
  isAsyncDelete = false,
  isRecursiveDelete,
  successMessage,
  afterDeleteAction,
}: UseEntityDeleteOptions) => {
  const { t } = useTranslation();
  const currentUserId = useApplicationStore((state) => state.currentUser?.id);
  const { onLogoutHandler } = useAuthProvider();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();

  return useCallback(
    async (deleteType: DeleteType): Promise<boolean> => {
      if (isAsyncDelete) {
        try {
          await handleOnAsyncEntityDeleteConfirm({
            entityName,
            entityId: entityId ?? '',
            entityType,
            deleteType,
            prepareType,
            isRecursiveDelete: isRecursiveDelete ?? false,
            afterDeleteAction,
          });

          return true;
        } catch {
          return false;
        }
      }

      try {
        const response = await deleteEntity(
          prepareType
            ? deleteWidgetClassBase.prepareEntityType(entityType)
            : entityType,
          entityId ?? '',
          Boolean(isRecursiveDelete),
          deleteType === DeleteType.HARD_DELETE
        );
        if (response.status !== 200) {
          showErrorToast(t('server.unexpected-response'));

          return false;
        }
        showSuccessToast(
          successMessage ??
            t('server.entity-deleted-successfully', { entity: entityName })
        );
        if (entityType === EntityType.USER && entityId === currentUserId) {
          onLogoutHandler();

          return true;
        }
        afterDeleteAction?.(
          deleteType === DeleteType.SOFT_DELETE,
          response.data.version
        );

        return true;
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', { entity: entityName })
        );

        return false;
      }
    },
    [
      t,
      entityName,
      entityType,
      entityId,
      prepareType,
      isAsyncDelete,
      isRecursiveDelete,
      successMessage,
      afterDeleteAction,
      currentUserId,
      onLogoutHandler,
      handleOnAsyncEntityDeleteConfirm,
    ]
  );
};
