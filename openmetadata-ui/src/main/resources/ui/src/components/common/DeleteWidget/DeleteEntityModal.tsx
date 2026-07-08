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

import {
  Button,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { EntityType } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { deleteEntity } from '../../../rest/miscAPI';
import deleteWidgetClassBase from '../../../utils/DeleteWidget/DeleteWidgetClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import {
  DeleteType,
  DeleteWidgetFormFields,
  DeleteWidgetModalProps,
} from './DeleteWidget.interface';

const DeleteEntityModal = ({
  allowSoftDelete = true,
  visible,
  deleteMessage,
  softDeleteMessagePostFix = '',
  hardDeleteMessagePostFix = '',
  entityName,
  entityType,
  onCancel,
  entityId,
  prepareType = true,
  isAsyncDelete = false,
  isRecursiveDelete,
  afterDeleteAction,
  successMessage,
  deleteOptions,
  onDelete,
  isDeleting = false,
}: DeleteWidgetModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { onLogoutHandler } = useAuthProvider();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();
  const [deletionType, setDeletionType] = useState<DeleteType>(
    allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
  );
  const [isLoading, setIsLoading] = useState(false);
  const entityTypeName = useMemo(() => startCase(entityType), [entityType]);

  const DELETE_OPTION = useMemo(
    () => [
      {
        title: t('label.soft-delete'),
        description: (
          <>
            {t('message.soft-delete-common-message', {
              entity: entityTypeName.toLowerCase(),
            })}
            {softDeleteMessagePostFix}
          </>
        ),
        type: DeleteType.SOFT_DELETE,
        isAllowed: allowSoftDelete,
      },
      {
        title: t('label.permanently-delete'),
        description: (
          <>
            {deleteMessage ??
              t('message.permanently-delete-common-message', {
                entity: entityTypeName.toLowerCase(),
              })}
            {hardDeleteMessagePostFix}
          </>
        ),
        type: DeleteType.HARD_DELETE,
        isAllowed: true,
      },
    ],
    [
      t,
      entityTypeName,
      softDeleteMessagePostFix,
      allowSoftDelete,
      deleteMessage,
      hardDeleteMessagePostFix,
    ]
  );

  const options = useMemo(
    () => (deleteOptions ?? DELETE_OPTION).filter((option) => option.isAllowed),
    [deleteOptions, DELETE_OPTION]
  );

  const handleOnEntityDeleteCancel = useCallback(() => {
    setDeletionType(
      allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
    );
    onCancel();
  }, [onCancel, allowSoftDelete]);

  const handleOnEntityDeleteConfirm = useCallback(
    async ({ deleteType }: DeleteWidgetFormFields) => {
      try {
        setIsLoading(true);
        const response = await deleteEntity(
          prepareType
            ? deleteWidgetClassBase.prepareEntityType(entityType)
            : entityType,
          entityId ?? '',
          Boolean(isRecursiveDelete),
          deleteType === DeleteType.HARD_DELETE
        );
        if (response.status === 200) {
          showSuccessToast(
            successMessage ??
              t('server.entity-deleted-successfully', {
                entity: entityName,
              })
          );

          if (entityType === EntityType.USER && entityId === currentUser?.id) {
            onLogoutHandler();

            return;
          }
          if (afterDeleteAction) {
            afterDeleteAction(
              deletionType === DeleteType.SOFT_DELETE,
              response.data.version
            );
          }
        } else {
          showErrorToast(t('server.unexpected-response'));
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: entityName,
          })
        );
      } finally {
        handleOnEntityDeleteCancel();
        setIsLoading(false);
      }
    },
    [
      entityType,
      entityId,
      isRecursiveDelete,
      deletionType,
      afterDeleteAction,
      entityName,
      handleOnEntityDeleteCancel,
      currentUser?.id,
    ]
  );

  const onConfirm = useCallback(async () => {
    const values: DeleteWidgetFormFields = {
      deleteType: deletionType,
      deleteTextInput: '',
    };
    if (isAsyncDelete) {
      setIsLoading(true);
      try {
        await handleOnAsyncEntityDeleteConfirm({
          entityName,
          entityId: entityId ?? '',
          entityType,
          deleteType: deletionType,
          prepareType,
          isRecursiveDelete: isRecursiveDelete ?? false,
          afterDeleteAction,
        });
      } finally {
        setIsLoading(false);
        handleOnEntityDeleteCancel();
      }
    } else {
      onDelete ? onDelete(values) : handleOnEntityDeleteConfirm(values);
    }
  }, [
    deletionType,
    isAsyncDelete,
    entityId,
    onDelete,
    entityName,
    entityType,
    prepareType,
    isRecursiveDelete,
    handleOnAsyncEntityDeleteConfirm,
    handleOnEntityDeleteConfirm,
    handleOnEntityDeleteCancel,
    afterDeleteAction,
  ]);

  useEffect(() => {
    setDeletionType(
      allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
    );
  }, [allowSoftDelete, visible]);

  useEffect(() => {
    setIsLoading(isDeleting);
  }, [isDeleting]);

  return (
    <ModalOverlay
      isDismissable={!isLoading}
      isOpen={visible}
      style={{ zIndex: 999 }}
      onOpenChange={(isOpen) =>
        !isOpen && !isLoading && handleOnEntityDeleteCancel()
      }>
      <Modal>
        <Dialog
          data-testid="delete-modal"
          width={480}
          onClose={handleOnEntityDeleteCancel}>
          <Dialog.Header className="tw:flex tw:flex-col tw:items-start tw:gap-4 tw:self-stretch tw:p-6 tw:pb-0">
            <FeaturedIcon
              color="error"
              icon={Trash01}
              size="lg"
              theme="light"
            />
            <Typography
              data-testid="modal-header"
              size="text-md"
              weight="semibold">
              {t('label.delete')} &quot;{entityName}&quot; {entityTypeName}
            </Typography>
          </Dialog.Header>
          <Dialog.Content className="tw:px-5 tw:sm:px-5">
            <RadioGroup
              className="tw:gap-3"
              size="md"
              value={deletionType}
              onChange={(value) => setDeletionType(value as DeleteType)}>
              {options.map((option) => (
                <RadioButton
                  className={({ isSelected }) =>
                    classNames(
                      'tw:cursor-pointer tw:rounded-xl tw:border tw:p-4 tw:transition-colors',
                      isSelected
                        ? 'tw:border-brand tw:ring-1 tw:ring-brand'
                        : 'tw:border-secondary'
                    )
                  }
                  data-testid={option.type}
                  hint={
                    <Typography
                      as="span"
                      className="tw:text-tertiary"
                      size="text-sm">
                      {option.description}
                    </Typography>
                  }
                  key={option.type}
                  label={
                    <Typography
                      as="span"
                      className="tw:text-primary"
                      size="text-sm">
                      {option.title}
                    </Typography>
                  }
                  size="md"
                  value={option.type}
                />
              ))}
            </RadioGroup>
          </Dialog.Content>
          <div className="tw:flex tw:justify-end tw:gap-3 tw:p-4 tw:py-6">
            <Button
              color="secondary"
              data-testid="discard-button"
              isDisabled={isLoading}
              size="sm"
              onPress={handleOnEntityDeleteCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="confirm-button"
              isDisabled={isLoading}
              isLoading={isLoading}
              size="sm"
              onPress={onConfirm}>
              {t('label.delete')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DeleteEntityModal;
