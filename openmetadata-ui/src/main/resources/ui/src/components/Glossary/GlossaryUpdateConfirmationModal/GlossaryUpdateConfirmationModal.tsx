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
/* eslint-disable i18next/no-literal-string */
import Icon from '@ant-design/icons';
import { Button, Modal, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ExclamationIcon } from '../../../assets/svg/ic-exclamation-circle.svg';
import { ClientErrors } from '../../../enums/axios.enum';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { Status } from '../../../generated/type/bulkOperationResult';
import {
  addAssetsToGlossaryTerm,
  GlossaryTermFailure,
} from '../../../rest/glossaryAPI';
import { searchData } from '../../../rest/miscAPI';
import {
  getEntityLinkFromType,
  getEntityName,
} from '../../../utils/EntityUtils';
import { escapeESReservedCharacters } from '../../../utils/StringsUtils';
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
      const { data } = await searchData(
        '',
        1,
        1000,
        `(tags.tagFQN:"${escapeESReservedCharacters(
          glossaryTerm.fullyQualifiedName
        )}")`,
        '',
        '',
        SearchIndex.ALL
      );

      const assets = data.hits.hits.map(({ _source: { id, entityType } }) => ({
        id,
        type: entityType,
      }));

      // dryRun validations so that we can list failures if any
      const res = await addAssetsToGlossaryTerm(
        { ...glossaryTerm, tags: updatedTags } as GlossaryTerm,
        assets,
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
      setTagError((err as AxiosError).response?.data);
    } finally {
      setValidating(false);
    }
  };

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
                `${failedStatus.numberOfRowsFailed} failed`}
            </Typography.Text>

            <Space size={8}>
              <Button onClick={onCancel}>{t('label.cancel')}</Button>
              <Button
                disabled={Boolean(failedStatus)}
                loading={validating}
                type="primary">
                {t('label.ok')}
              </Button>
            </Space>
          </div>
        )
      }
      title={tagAdditionConfirmation ? 'Following entities failed' : undefined}
      width={tagAdditionConfirmation ? 750 : undefined}
      onCancel={onCancel}>
      {tagAdditionConfirmation ? (
        <div className="d-flex flex-column gap-2">
          {!isEmpty(failedStatus?.failedRequest) && !validating && (
            <>
              <Table
                bordered
                columns={[
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
                        {getEntityName(record)}
                      </Link>
                    ),
                  },
                  {
                    title: t('label.failure-reason'),
                    dataIndex: 'error',
                    key: 'error',
                    render: (error: string) => (
                      <Typography.Paragraph>{error}</Typography.Paragraph>
                    ),
                  },
                ]}
                dataSource={failedStatus?.failedRequest}
                loading={validating}
                pagination={false}
                rowKey={(record) => record.request.id}
              />

              <Typography.Text italic className="m-t-sm" type="secondary">
                You can either remove this assets or remove conflicting tag from
                the asset and try again adding tags!
              </Typography.Text>
            </>
          )}
          {tagError?.code === ClientErrors.BAD_REQUEST && (
            <Typography.Text type="danger">{tagError.message}</Typography.Text>
          )}
        </div>
      ) : (
        <div className="d-flex items-center flex-column gap-4">
          <Icon
            className="m-b-md"
            component={ExclamationIcon}
            style={{ fontSize: '60px' }}
          />

          <Typography.Title level={5}>
            Would you like to proceed with adding a new tag?
          </Typography.Title>
          <Typography.Text className="text-center">
            This action will apply the tag to all Assets linked to the Glossary
            Term{' '}
            <span className="font-medium">{getEntityName(glossaryTerm)}</span>
          </Typography.Text>
          <div className="m-t-md">
            <Space size={8}>
              <Button onClick={onCancel}>No, cancel</Button>
              <Button
                loading={validating}
                type="primary"
                onClick={handleUpdateConfirmation}>
                Yes, confirm
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};
