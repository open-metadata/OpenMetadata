/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons';
import { Button, Modal, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ExclamationIcon } from '../../../assets/svg/ic-exclamation-circle.svg';
import { ClientErrors } from '../../../enums/axios.enum';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { Status } from '../../../generated/type/bulkOperationResult';
import {
  GlossaryTermFailure,
  validateTagAddtionToGlossary,
} from '../../../rest/glossaryAPI';
import {
  getEntityLinkFromType,
  getEntityName,
} from '../../../utils/EntityUtils';
import Table from '../../common/Table/Table';
import { GlossaryUpdateConfirmationModalProps } from './GlossaryUpdateConfirmationModal.interface';

export const GlossaryUpdateConfirmationModal = ({
  glossaryTerm,
  onValidationSuccess,
  onCancel,
  updatedTags,
}: GlossaryUpdateConfirmationModalProps) => {
  const [failedStatus, setFailedStatus] = useState<GlossaryTermFailure>();
  const [tagError, setTagError] = useState<{ code: number; message: string }>();
  const [tagAdditionConfirmation, setTagAdditionConfirmation] = useState(false);
  const [validating, setValidating] = useState(false);
  const { t } = useTranslation();

  const handleUpdateConfirmation = async () => {
    setTagAdditionConfirmation(true);
    setValidating(true);
    try {
      // dryRun validations so that we can list failures if any
      const res = await validateTagAddtionToGlossary(
        { ...glossaryTerm, tags: updatedTags } as GlossaryTerm,
        true
      );

      if (
        res.status &&
        (res as GlossaryTermFailure).status === Status.Success
      ) {
        await onValidationSuccess();
      } else {
        setFailedStatus(res as GlossaryTermFailure);
      }
    } catch (err) {
      // error
      setTagError(err.response?.data);
    } finally {
      setValidating(false);
    }
  };

  const tagsColumn = useMemo(() => {
    return [
      {
        title: t('label.asset-plural'),
        dataIndex: 'request',
        key: 'request',
        render: (record: EntityReference) => (
          <Link
            target="_blank"
            to={getEntityLinkFromType(
              record.fullyQualifiedName ?? '',
              record.type as EntityType
            )}>
            {record.fullyQualifiedName}
          </Link>
        ),
      },
      {
        title: t('label.failure-reason'),
        dataIndex: 'message',
        key: 'message',
        render: (error: string) => (
          <Typography.Paragraph>{error}</Typography.Paragraph>
        ),
      },
    ];
  }, []);

  return (
    <Modal
      centered
      open
      closable={false}
      closeIcon={null}
      footer={
        tagAdditionConfirmation && (
          <div className="d-flex justify-between">
            <Typography.Text type="secondary">
              {failedStatus?.numberOfRowsFailed &&
                `${failedStatus.numberOfRowsFailed} ${t('label.failed')}`}
            </Typography.Text>
            <Button onClick={onCancel}>{t('label.cancel')}</Button>
          </div>
        )
      }
      title={
        tagAdditionConfirmation
          ? t('message.glossary-tag-update-modal-title')
          : undefined
      }
      width={tagAdditionConfirmation ? 750 : undefined}
      onCancel={onCancel}>
      {tagAdditionConfirmation || validating ? (
        <div className="d-flex flex-column gap-2">
          {!isEmpty(failedStatus?.failedRequest) && !validating && (
            <>
              <Table
                bordered
                columns={tagsColumn}
                dataSource={failedStatus?.failedRequest}
                loading={validating}
                pagination={false}
                rowKey={(record) => record.request.id}
              />
              <Typography.Text italic className="m-t-sm" type="secondary">
                {t('message.glossary-tag-assignement-help-message')}
              </Typography.Text>
            </>
          )}
          {tagError?.code === ClientErrors.BAD_REQUEST && (
            <Typography.Text type="danger">{tagError.message}</Typography.Text>
          )}
        </div>
      ) : (
        <div className="d-flex items-center flex-column gap-2">
          <Icon
            className="m-b-lg"
            component={ExclamationIcon}
            style={{ fontSize: '60px' }}
          />
          <Typography.Title level={5}>
            {t('message.tag-update-confirmation')}
          </Typography.Title>
          <Typography.Text className="text-center">
            {t('message.glossary-tag-update-description')}{' '}
            <span className="font-medium">{getEntityName(glossaryTerm)}</span>
          </Typography.Text>
          <div className="m-t-lg">
            <Space size={8}>
              <Button onClick={onCancel}>{t('label.no-comma-cancel')}</Button>
              <Button
                loading={validating}
                type="primary"
                onClick={handleUpdateConfirmation}>
                {t('label.yes-comma-confirm')}
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};
