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

import {
  Button,
  Form,
  Modal,
  Radio,
  RadioChangeEvent,
  Space,
  Typography,
} from 'antd';
import Input, { InputRef } from 'antd/lib/input/Input';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { EntityType } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { deleteEntity } from '../../../rest/miscAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import deleteWidgetClassBase from '../../../utils/DeleteWidget/DeleteWidgetClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import './delete-widget-modal.style.less';
import {
  DeleteType,
  DeleteWidgetFormFields,
  DeleteWidgetModalProps,
} from './DeleteWidget.interface';

export const DELETE_CONFIRMATION_TEXT = 'DELETE';

const DeleteWidgetModal = ({
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
  const [form] = Form.useForm();
  const { currentUser } = useApplicationStore();
  const { onLogoutHandler } = useAuthProvider();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();
  const [deleteConfirmationText, setDeleteConfirmationText] =
    useState<string>('');
  const [deletionType, setDeletionType] = useState<DeleteType>(
    allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
  );
  const [isLoading, setIsLoading] = useState(false);
  const deleteTextInputRef = useRef<InputRef>(null);
  const entityTypeName = useMemo(() => {
    return startCase(entityType);
  }, [entityType]);

  const DELETE_OPTION = useMemo(
    () => [
      {
        title: `${t('label.delete')} ${entityTypeName} "${entityName}"`,
        description: (
          <>
            {deleteWidgetClassBase.getDeleteMessage(
              entityName,
              entityType,
              true
            )}
            {softDeleteMessagePostFix}
          </>
        ),
        type: DeleteType.SOFT_DELETE,
        isAllowed: allowSoftDelete,
      },
      {
        title: `${t(
          'label.permanently-delete'
        )} ${entityTypeName} "${entityName}"`,
        description: (
          <>
            {deleteMessage ??
              deleteWidgetClassBase.getDeleteMessage(entityName, entityType)}
            {hardDeleteMessagePostFix}
          </>
        ),
        type: DeleteType.HARD_DELETE,
        isAllowed: true,
      },
    ],
    [
      entityType,
      entityName,
      softDeleteMessagePostFix,
      allowSoftDelete,
      deleteMessage,
      hardDeleteMessagePostFix,
    ]
  );

  const handleOnChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDeleteConfirmationText(e.target.value);
  }, []);

  const handleOnEntityDeleteCancel = useCallback(() => {
    setDeleteConfirmationText('');
    setDeletionType(
      allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
    );
    onCancel();
  }, [onCancel, allowSoftDelete]);

  const isDeleteTextPresent = useMemo(() => {
    return (
      deleteConfirmationText.toLowerCase() ===
        DELETE_CONFIRMATION_TEXT.toLowerCase() &&
      (deletionType === DeleteType.SOFT_DELETE ||
        deletionType === DeleteType.HARD_DELETE)
    );
  }, [deleteConfirmationText, deletionType]);

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
        if (isDeleteTextPresent) {
          handleOnEntityDeleteCancel();
        }
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
      isDeleteTextPresent,
      currentUser?.id,
    ]
  );

  const onFormFinish = useCallback(
    async (values: DeleteWidgetFormFields) => {
      if (isAsyncDelete) {
        setIsLoading(true);
        await handleOnAsyncEntityDeleteConfirm({
          entityName,
          entityId: entityId ?? '',
          entityType,
          deleteType: values.deleteType,
          prepareType,
          isRecursiveDelete: isRecursiveDelete ?? false,
          afterDeleteAction,
        });
        setIsLoading(false);
        handleOnEntityDeleteCancel();
      } else {
        onDelete ? onDelete(values) : handleOnEntityDeleteConfirm(values);
      }
    },
    [
      entityId,
      onDelete,
      entityName,
      entityType,
      prepareType,
      isRecursiveDelete,
      handleOnEntityDeleteConfirm,
      handleOnEntityDeleteCancel,
      afterDeleteAction,
    ]
  );

  const onChange = useCallback((e: RadioChangeEvent) => {
    const value = e.target.value;
    setDeletionType(value);
  }, []);

  useEffect(() => {
    let timeout: number;

    if (visible) {
      // using setTimeout here as directly calling focus() doesn't focus element after first time
      timeout = window.setTimeout(() => {
        deleteTextInputRef.current?.focus();
      }, 1);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [visible, deleteTextInputRef]);

  useEffect(() => {
    setDeletionType(
      allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
    );
  }, [allowSoftDelete]);

  const handleConfirmClick = useCallback(() => form.submit(), []);

  const footer = useMemo(() => {
    return (
      <Space data-testid="footer" size={8}>
        <Button
          data-testid="discard-button"
          disabled={isLoading}
          type="link"
          onClick={handleOnEntityDeleteCancel}>
          {t('label.cancel')}
        </Button>

        <Button
          data-testid="confirm-button"
          disabled={!isDeleteTextPresent}
          htmlType="submit"
          loading={isLoading}
          type="primary"
          onClick={handleConfirmClick}>
          {t('label.confirm')}
        </Button>
      </Space>
    );
  }, [handleOnEntityDeleteCancel, isDeleteTextPresent, isLoading]);

  useEffect(() => {
    // Resetting the form values on visibility change
    // Using setFieldsValue instead of resetValue as the default value to be set
    // is dynamic i.e. dependent on allowSoftDelete prop which sets it to undefined
    // if reset using resetValue
    form.setFieldsValue({
      deleteType: allowSoftDelete
        ? DeleteType.SOFT_DELETE
        : DeleteType.HARD_DELETE,
      deleteTextInput: '',
    });
  }, [visible]);

  useEffect(() => {
    setIsLoading(isDeleting);
  }, [isDeleting]);

  return (
    // Used Button to stop click propagation event in the
    // TeamDetailsV1 and User.component collapsible panel.
    <Button
      className="remove-button-default-styling"
      onClick={(e) => e.stopPropagation()}>
      <Modal
        destroyOnClose
        closable={false}
        confirmLoading={isLoading}
        data-testid="delete-modal"
        footer={footer}
        maskClosable={false}
        okText={t('label.delete')}
        open={visible}
        title={`${t('label.delete')} ${entityType} "${entityName}"`}
        onCancel={handleOnEntityDeleteCancel}>
        <Form form={form} onFinish={onFormFinish}>
          <Form.Item<DeleteWidgetFormFields> className="m-0" name="deleteType">
            <Radio.Group onChange={onChange}>
              {(deleteOptions ?? DELETE_OPTION).map(
                (option) =>
                  option.isAllowed && (
                    <Radio
                      data-testid={option.type}
                      key={option.type}
                      value={option.type}>
                      <Typography.Paragraph
                        className="delete-widget-title break-all"
                        data-testid={`${option.type}-option`}>
                        {option.title}
                      </Typography.Paragraph>
                      <Typography.Paragraph className="text-grey-muted text-xs break-all">
                        {option.description}
                      </Typography.Paragraph>
                    </Radio>
                  )
              )}
            </Radio.Group>
          </Form.Item>
          <div>
            <div className="m-b-xss">
              <Transi18next
                i18nKey="message.type-delete-to-confirm"
                renderElement={<strong />}
              />
            </div>

            <Form.Item<DeleteWidgetFormFields>
              className="m-0"
              name="deleteTextInput"
              rules={[
                {
                  required: true,
                  message: t('message.please-type-text-to-confirm', {
                    text: DELETE_CONFIRMATION_TEXT,
                  }),
                  type: 'enum',
                  enum: [DELETE_CONFIRMATION_TEXT],
                },
              ]}>
              <Input
                autoComplete="off"
                data-testid="confirmation-text-input"
                disabled={isLoading}
                name="entityName"
                placeholder={DELETE_CONFIRMATION_TEXT}
                ref={deleteTextInputRef}
                type="text"
                onChange={handleOnChange}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Button>
  );
};

export default DeleteWidgetModal;
