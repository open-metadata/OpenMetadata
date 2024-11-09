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
import { Alert, Button, Modal, Progress, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ExclamationIcon } from '../../../assets/svg/ic-exclamation-circle.svg';
import { ClientErrors } from '../../../enums/Axios.enum';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import {
  BulkOperationResult,
  Status,
} from '../../../generated/type/bulkOperationResult';
import { validateTagAddtionToGlossary } from '../../../rest/glossaryAPI';
import {
  getEntityLinkFromType,
  getEntityName,
} from '../../../utils/EntityUtils';
import Table from '../../common/Table/Table';
import {
  GlossaryUpdateConfirmationModalProps,
  UpdateState,
} from './GlossaryUpdateConfirmationModal.interface';

export const GlossaryUpdateConfirmationModal = ({
  glossaryTerm,
  onValidationSuccess,
  onCancel,
  updatedTags,
}: GlossaryUpdateConfirmationModalProps) => {
  const [failedStatus, setFailedStatus] = useState<BulkOperationResult>();
  const [tagError, setTagError] = useState<{ code: number; message: string }>();
  const [updateState, setUpdateState] = useState(UpdateState.INITIAL);
  const { t } = useTranslation();

  const handleUpdateConfirmation = async () => {
    setUpdateState(UpdateState.VALIDATING);

    try {
      // dryRun validations so that we can list failures if any
      const res = await validateTagAddtionToGlossary(
        { ...glossaryTerm, tags: updatedTags } as GlossaryTerm,
        true
      );

      if (res.status === Status.Success) {
        setUpdateState(UpdateState.UPDATING);
        try {
          await onValidationSuccess();
          setUpdateState(UpdateState.SUCCESS);
        } catch (err) {
          // Error
        } finally {
          setTimeout(onCancel, 500);
        }
      } else {
        setUpdateState(UpdateState.FAILED);
        setFailedStatus(res);
      }
    } catch (err) {
      // error
      setTagError(err.response?.data);
      setUpdateState(UpdateState.FAILED);
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

  const progress =
    updateState === UpdateState.VALIDATING
      ? 10
      : updateState === UpdateState.UPDATING
      ? 60
      : 100;

  const data = useMemo(() => {
    const footer = (
      <div className="d-flex justify-between">
        <Typography.Text type="secondary">
          {failedStatus?.numberOfRowsFailed &&
            `${failedStatus.numberOfRowsFailed} ${t('label.failed')}`}
        </Typography.Text>
        <Button onClick={onCancel}>{t('label.cancel')}</Button>
      </div>
    );

    const progressBar = (
      <div className="text-center">
        <Progress percent={progress} status="normal" type="circle" />
      </div>
    );

    switch (updateState) {
      case UpdateState.INITIAL:
        return {
          footer: null,
          content: (
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
                <span className="font-medium">
                  {getEntityName(glossaryTerm)}
                </span>
              </Typography.Text>
              <div className="m-t-lg">
                <Space size={8}>
                  <Button onClick={onCancel}>
                    {t('label.no-comma-cancel')}
                  </Button>
                  <Button type="primary" onClick={handleUpdateConfirmation}>
                    {t('label.yes-comma-confirm')}
                  </Button>
                </Space>
              </div>
            </div>
          ),
        };
      case UpdateState.VALIDATING:
        return {
          content: progressBar,
          footer: footer,
        };
      case UpdateState.FAILED:
        return {
          content: (
            <div className="d-flex flex-column gap-2">
              {failedStatus && (
                <>
                  <Table
                    bordered
                    columns={tagsColumn}
                    dataSource={failedStatus?.failedRequest ?? []}
                    pagination={{
                      pageSize: 5,
                      showSizeChanger: true,
                    }}
                    rowKey={(record) => record.request?.id}
                  />
                  <Alert
                    className="m-t-sm"
                    message={t('message.glossary-tag-assignment-help-message')}
                    type="warning"
                  />
                </>
              )}
              {tagError?.code === ClientErrors.BAD_REQUEST && (
                <Alert message={tagError.message} type="warning" />
              )}
            </div>
          ),
          footer: (
            <div className="d-flex justify-between">
              <Typography.Text type="secondary">
                {failedStatus?.numberOfRowsFailed &&
                  `${failedStatus.numberOfRowsFailed} ${t('label.failed')}`}
              </Typography.Text>
              <Button onClick={onCancel}>{t('label.cancel')}</Button>
            </div>
          ),
        };
      case UpdateState.UPDATING:
        return {
          content: progressBar,
          footer: <Button onClick={onCancel}>{t('label.cancel')}</Button>,
        };
      case UpdateState.SUCCESS:
        return {
          content: progressBar,
          footer: <Button onClick={onCancel}>{t('label.cancel')}</Button>,
        };
    }
  }, [updateState, failedStatus]);

  const modalTitle = useMemo(() => {
    switch (updateState) {
      case UpdateState.VALIDATING:
      case UpdateState.UPDATING:
      case UpdateState.SUCCESS:
        return t('message.glossary-tag-update-modal-title-validating');
      case UpdateState.FAILED:
        return t('message.glossary-tag-update-modal-title-failed');
      default:
        return undefined;
    }
  }, [updateState]);

  return (
    <Modal
      centered
      open
      closable={false}
      closeIcon={null}
      footer={data.footer}
      title={modalTitle}
      width={updateState === UpdateState.FAILED ? 750 : undefined}
      onCancel={onCancel}>
      {data.content}
    </Modal>
  );
};
