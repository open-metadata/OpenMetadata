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

import { Modal, Radio, RadioChangeEvent } from 'antd';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { deleteEntity } from 'rest/miscAPI';
import { ENTITY_DELETE_STATE } from '../../../constants/entity.constants';
import { EntityType } from '../../../enums/entity.enum';
import jsonData from '../../../jsons/en';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import { getTitleCase } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';
import { DeleteType, DeleteWidgetModalProps } from './DeleteWidget.interface';

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
}: DeleteWidgetModalProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [entityDeleteState, setEntityDeleteState] =
    useState<typeof ENTITY_DELETE_STATE>(ENTITY_DELETE_STATE);
  const [name, setName] = useState<string>('');
  const [value, setValue] = useState<DeleteType>(
    allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE
  );
  const [isLoading, setIsLoading] = useState(false);

  const prepareDeleteMessage = (softDelete = false) => {
    const softDeleteText = `Soft deleting will deactivate the ${entityName}. This will disable any discovery, read or write operations on ${entityName}.`;
    const hardDeleteText = getEntityDeleteMessage(getTitleCase(entityType), '');

    return softDelete ? softDeleteText : hardDeleteText;
  };

  const DELETE_OPTION = [
    {
      title: `Delete ${entityType} “${entityName}”`,
      description: `${prepareDeleteMessage(true)} ${softDeleteMessagePostFix}`,
      type: DeleteType.SOFT_DELETE,
      isAllowd: allowSoftDelete,
    },
    {
      title: `Permanently Delete ${entityType} “${entityName}”`,
      description: `${
        deleteMessage || prepareDeleteMessage()
      } ${hardDeleteMessagePostFix}`,
      type: DeleteType.HARD_DELETE,
      isAllowd: true,
    },
  ];

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleOnEntityDelete = (softDelete = true) => {
    setEntityDeleteState((prev) => ({ ...prev, state: true, softDelete }));
  };

  const handleOnEntityDeleteCancel = () => {
    setEntityDeleteState(ENTITY_DELETE_STATE);
    setName('');
    setValue(DeleteType.SOFT_DELETE);
    onCancel();
  };

  const prepareEntityType = () => {
    const services = [
      EntityType.DASHBOARD_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.METADATA_SERVICE,
    ];

    if (services.includes((entityType || '') as EntityType)) {
      return `services/${entityType}s`;
    } else if (entityType === EntityType.GLOSSARY) {
      return `glossaries`;
    } else if (entityType === EntityType.POLICY) {
      return 'policies';
    } else if (
      entityType === EntityType.TEST_SUITE ||
      entityType === EntityType.KPI
    ) {
      return entityType;
    } else {
      return `${entityType}s`;
    }
  };

  const getMessage = (message: string) => {
    return message.replace('Entity', startCase(entityType));
  };

  const handleOnEntityDeleteConfirm = () => {
    setIsLoading(false);
    setEntityDeleteState((prev) => ({ ...prev, loading: 'waiting' }));
    deleteEntity(
      prepareType ? prepareEntityType() : entityType,
      entityId ?? '',
      Boolean(isRecursiveDelete),
      !entityDeleteState.softDelete
    )
      .then((res) => {
        if (res.status === 200) {
          setTimeout(() => {
            handleOnEntityDeleteCancel();
            showSuccessToast(
              getMessage(
                jsonData['api-success-messages']['delete-entity-success']
              )
            );

            if (afterDeleteAction) {
              afterDeleteAction();
            } else {
              setTimeout(() => {
                history.push('/');
              }, 500);
            }
          }, 1000);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['delete-entity-error']
        );
      })
      .finally(() => {
        handleOnEntityDeleteCancel();
        setIsLoading(false);
      });
  };

  const isNameMatching = useCallback(() => {
    return (
      name === 'DELETE' &&
      (value === DeleteType.SOFT_DELETE || value === DeleteType.HARD_DELETE)
    );
  }, [name]);

  const onChange = (e: RadioChangeEvent) => {
    const value = e.target.value;
    setValue(value);
    handleOnEntityDelete(value === DeleteType.SOFT_DELETE);
  };

  useEffect(() => {
    setValue(allowSoftDelete ? DeleteType.SOFT_DELETE : DeleteType.HARD_DELETE);
    setEntityDeleteState({
      ...ENTITY_DELETE_STATE,
      softDelete: allowSoftDelete,
    });
  }, [allowSoftDelete]);

  const Footer = () => {
    return (
      <div className="tw-justify-end" data-testid="footer">
        <Button
          className="tw-mr-2"
          data-testid="discard-button"
          disabled={entityDeleteState.loading === 'waiting'}
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleOnEntityDeleteCancel}>
          {t('label.cancel')}
        </Button>
        {entityDeleteState.loading === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-8 tw-rounded-md disabled:tw-opacity-100"
            data-testid="loading-button"
            size="custom"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : (
          <Button
            className="tw-h-8 tw-px-3 tw-py-2 tw-rounded-md"
            data-testid="confirm-button"
            disabled={!isNameMatching()}
            size="custom"
            theme="primary"
            variant="contained"
            onClick={handleOnEntityDeleteConfirm}>
            {t('label.confirm')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Modal
      closable={false}
      confirmLoading={isLoading}
      data-testid="delete-modal"
      footer={Footer()}
      okText="Delete"
      open={visible}
      title={`Delete ${entityName}`}
      onCancel={handleOnEntityDeleteCancel}>
      <Radio.Group value={value} onChange={onChange}>
        {DELETE_OPTION.map(
          (option) =>
            option.isAllowd && (
              <Radio
                data-testid={option.type}
                key={option.type}
                value={option.type}>
                <p
                  className="tw-text-sm tw-mb-1 tw-font-medium"
                  data-testid={`${option.type}-option`}>
                  {option.title}
                </p>
                <p className="tw-text-grey-muted tw-text-xs tw-mb-2">
                  {option.description}
                </p>
              </Radio>
            )
        )}
      </Radio.Group>
      <div>
        <p className="tw-mb-2">
          {t('label.type')} <strong>{t('label.delete-uppercase')}</strong>{' '}
          {t('label.to-lowercase')}
          {t('label.confirm-lowercase')}
        </p>
        <input
          autoComplete="off"
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="confirmation-text-input"
          disabled={entityDeleteState.loading === 'waiting'}
          name="entityName"
          placeholder="DELETE"
          type="text"
          value={name}
          onChange={handleOnChange}
        />
      </div>
    </Modal>
  );
};

export default DeleteWidgetModal;
