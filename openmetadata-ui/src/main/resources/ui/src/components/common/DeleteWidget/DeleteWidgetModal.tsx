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
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_DELETE_STATE } from '../../../constants/entity.constants';
import { deleteEntity } from '../../../rest/miscAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import {
  getDeleteMessage,
  prepareEntityType,
} from '../../../utils/DeleteWidgetModalUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
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
  isRecursiveDelete,
  afterDeleteAction,
  successMessage,
  deleteOptions,
}: DeleteWidgetModalProps) => {
  const { t } = useTranslation();
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);
  const [deleteConfirmationText, setDeleteConfirmationText] =
    useState<string>('');
  const [value, setValue] = useState<DeleteType>(
    allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
  );
  const [isLoading, setIsLoading] = useState(false);
  const deleteTextInputRef = useRef<InputRef>(null);

  const DELETE_OPTION = useMemo(
    () => [
      {
        title: `${t('label.delete')} ${entityType} “${entityName}”`,
        description: `${getDeleteMessage(
          entityName,
          entityType,
          true
        )} ${softDeleteMessagePostFix}`,
        type: DeleteType.SOFT_DELETE,
        isAllowed: allowSoftDelete,
      },
      {
        title: `${t('label.permanently-delete')} ${entityType} “${entityName}”`,
        description: `${
          deleteMessage || getDeleteMessage(entityName, entityType)
        } ${hardDeleteMessagePostFix}`,
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

  const handleOnEntityDelete = useCallback((softDelete = true) => {
    setEntityDeleteState((prev) => ({ ...prev, state: true, softDelete }));
  }, []);

  const handleOnEntityDeleteCancel = useCallback(() => {
    setEntityDeleteState({
      ...ENTITY_DELETE_STATE,
      softDelete: allowSoftDelete,
    });
    setDeleteConfirmationText('');
    setValue(allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE);
    onCancel();
  }, [onCancel, allowSoftDelete]);

  const isDeleteTextPresent = useMemo(() => {
    return (
      deleteConfirmationText === DELETE_CONFIRMATION_TEXT &&
      (value === DeleteType.SOFT_DELETE || value === DeleteType.HARD_DELETE)
    );
  }, [deleteConfirmationText]);

  const handleOnEntityDeleteConfirm = useCallback(async () => {
    try {
      setIsLoading(false);
      setEntityDeleteState((prev) => ({ ...prev, loading: 'waiting' }));
      const response = await deleteEntity(
        prepareType ? prepareEntityType(entityType) : entityType,
        entityId ?? '',
        Boolean(isRecursiveDelete),
        !entityDeleteState.softDelete
      );

      if (response.status === 200) {
        showSuccessToast(
          successMessage ??
            t('server.entity-deleted-successfully', {
              entity: startCase(entityType),
            })
        );
        if (afterDeleteAction) {
          afterDeleteAction(entityDeleteState.softDelete);
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
  }, [
    entityType,
    entityId,
    isRecursiveDelete,
    entityDeleteState,
    afterDeleteAction,
    entityName,
    handleOnEntityDeleteCancel,
    isDeleteTextPresent,
  ]);

  const onChange = useCallback(
    (e: RadioChangeEvent) => {
      const value = e.target.value;
      setValue(value);
      handleOnEntityDelete(value === DeleteType.SOFT_DELETE);
    },
    [handleOnEntityDelete]
  );

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
    setValue(allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE);
    setEntityDeleteState({
      ...ENTITY_DELETE_STATE,
      softDelete: allowSoftDelete,
    });
  }, [allowSoftDelete]);

  const footer = useMemo(() => {
    return (
      <Space data-testid="footer" size={8}>
        <Button
          data-testid="discard-button"
          disabled={entityDeleteState.loading === 'waiting'}
          type="link"
          onClick={handleOnEntityDeleteCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="confirm-button"
          disabled={!isDeleteTextPresent}
          loading={entityDeleteState.loading === 'waiting'}
          type="primary"
          onClick={handleOnEntityDeleteConfirm}>
          {t('label.confirm')}
        </Button>
      </Space>
    );
  }, [
    entityDeleteState,
    handleOnEntityDeleteCancel,
    handleOnEntityDeleteConfirm,
    isDeleteTextPresent,
  ]);

  return (
    <Modal
      closable={false}
      confirmLoading={isLoading}
      data-testid="delete-modal"
      footer={footer}
      maskClosable={false}
      okText={t('label.delete')}
      open={visible}
      title={`${t('label.delete')} ${entityName}`}
      onCancel={handleOnEntityDeleteCancel}>
      <Form onFinish={handleOnEntityDeleteConfirm}>
        <Form.Item
          className="m-0"
          rules={[
            {
              required: true,
              type: 'enum',
              enum: [DeleteType.SOFT_DELETE, DeleteType.HARD_DELETE],
            },
          ]}>
          <Radio.Group value={value} onChange={onChange}>
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
                  text: t('label.delete-uppercase'),
                }),
                type: 'enum',
                enum: [DELETE_CONFIRMATION_TEXT],
              },
            ]}>
            <Input
              autoComplete="off"
              data-testid="confirmation-text-input"
              disabled={entityDeleteState.loading === 'waiting'}
              name="entityName"
              placeholder={t('label.delete-uppercase')}
              ref={deleteTextInputRef}
              type="text"
              value={deleteConfirmationText}
              onChange={handleOnChange}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

export default DeleteWidgetModal;
