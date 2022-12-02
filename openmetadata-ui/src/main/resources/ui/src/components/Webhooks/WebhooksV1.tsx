/*
 *  Copyright 2021 Collate
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

import { Button as ButtonAntd, Col, Row, Select, Space, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isNil } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { deleteWebhook } from '../../axiosAPIs/webhookAPI';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { WEBHOOK_DOCS } from '../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { WebhookType } from '../../generated/api/events/createWebhook';
import { Webhook } from '../../generated/entity/events/webhook';
import { Operation } from '../../generated/entity/policies/policy';
import { checkPermission } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { statuses } from '../AddWebhook/WebhookConstants';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { WebhooksV1Props } from './WebhooksV1.interface';
import WebhookTable from './WebhookTable';
import './webhookV1.less';

const WEBHOOKS_INTEGRATION: { [key: string]: string } = {
  msteams: 'MS Teams',
  slack: 'Slack',
  generic: 'Webhook',
};

const WebhooksV1: FC<WebhooksV1Props> = ({
  data = [],
  webhookType = WebhookType.Generic,
  paging,
  selectedStatus = [],
  onAddWebhook,
  onClickWebhook,
  onPageChange,
  onStatusFilter,
  currentPage,
}) => {
  const [filteredData, setFilteredData] = useState<Array<Webhook>>(data);
  const [selectedWebhook, setWebhook] = useState<Webhook>();

  const { permissions } = usePermissionProvider();

  const addWebhookPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const getFilteredWebhooks = () => {
    return selectedStatus.length
      ? data.filter(
          (item) => item.status && selectedStatus.includes(item.status)
        )
      : data;
  };

  const fetchErrorPlaceHolder = useMemo(
    () => (message: string) => {
      return (
        <ErrorPlaceHolder
          buttons={
            <p className="tw-text-center">
              <Tooltip
                placement="left"
                title={
                  addWebhookPermission
                    ? `Add ${WEBHOOKS_INTEGRATION[webhookType]}`
                    : NO_PERMISSION_FOR_ACTION
                }>
                <ButtonAntd
                  ghost
                  className={classNames(
                    'tw-h-8 tw-rounded tw-my-3 add-webhook-btn'
                  )}
                  data-testid="add-webhook-button"
                  disabled={!addWebhookPermission}
                  size="small"
                  type="primary"
                  onClick={onAddWebhook}>
                  Add {WEBHOOKS_INTEGRATION[webhookType]}
                </ButtonAntd>
              </Tooltip>
            </p>
          }
          doc={WEBHOOK_DOCS}
          heading={message}
          type="ADD_DATA"
        />
      );
    },
    []
  );

  const handleDelete = async () => {
    try {
      const response = await deleteWebhook(selectedWebhook?.id as string);
      if (response) {
        setFilteredData((prev) =>
          prev.filter((webhook) => webhook.id !== response.id)
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setWebhook(undefined);
    }
  };

  useEffect(() => {
    setFilteredData(getFilteredWebhooks());
  }, [data, selectedStatus]);

  if (data.length === 0) {
    return fetchErrorPlaceHolder(WEBHOOKS_INTEGRATION[webhookType]);
  }

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={18}>
          <Select
            showArrow
            bordered={false}
            className="tw-text-body webhook-filter-select cursor-pointer"
            mode="multiple"
            options={statuses}
            placeholder="Filter by status"
            style={{ minWidth: '148px' }}
            onChange={onStatusFilter}
          />
        </Col>
        <Col xs={6}>
          <Space align="center" className="tw-w-full tw-justify-end" size={16}>
            <Tooltip
              placement="left"
              title={
                addWebhookPermission ? 'Add Webhook' : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                className={classNames('tw-h-8 tw-rounded ')}
                data-testid="add-webhook-button"
                disabled={!addWebhookPermission}
                size="small"
                theme="primary"
                variant="contained"
                onClick={onAddWebhook}>
                Add {WEBHOOKS_INTEGRATION[webhookType]}
              </Button>
            </Tooltip>
          </Space>
        </Col>
        <Col xs={24}>
          <WebhookTable
            webhookList={filteredData || []}
            onDelete={(data) => setWebhook(data)}
            onEdit={onClickWebhook}
          />
          {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={paging}
              pagingHandler={onPageChange}
              totalCount={paging.total}
            />
          )}
        </Col>
      </Row>
      {selectedWebhook && (
        <ConfirmationModal
          visible
          bodyText={t('message.delete-webhook-permanently', {
            webhookName: selectedWebhook.name,
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.delete')}
          header={t('label.are-you-sure')}
          onCancel={() => setWebhook(undefined)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
};

export default WebhooksV1;
