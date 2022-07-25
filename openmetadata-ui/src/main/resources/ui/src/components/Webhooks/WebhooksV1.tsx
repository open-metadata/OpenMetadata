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

import { Card, Select, Space } from 'antd';
import classNames from 'classnames';
import { isNil } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import {
  PAGE_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { Webhook } from '../../generated/entity/events/webhook';
import { useAuth } from '../../hooks/authHooks';
import { statuses } from '../AddWebhook/WebhookConstants';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import WebhookDataCard from '../common/webhook-data-card/WebhookDataCard';
import { leftPanelAntCardStyle } from '../containers/PageLayout';
import { WebhooksProps } from './Webhooks.interface';
import './webhookV1.less';

const WebhooksV1: FC<WebhooksProps> = ({
  data = [],
  paging,
  selectedStatus = [],
  onAddWebhook,
  onClickWebhook,
  onPageChange,
  onStatusFilter,
  currentPage,
}) => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [filteredData, setFilteredData] = useState<Array<Webhook>>(data);

  const getFilteredWebhooks = () => {
    return selectedStatus.length
      ? data.filter(
          (item) => item.status && selectedStatus.includes(item.status)
        )
      : data;
  };

  const fetchRightPanel = useMemo(
    () => () => {
      return (
        <Card
          data-testid="data-summary-container"
          style={leftPanelAntCardStyle}>
          <div className="tw-my-2">
            The webhook allows external services to be notified of the metadata
            change events happening in your organization through APIs. Register
            callback URLs with webhook integration to receive metadata event
            notifications. You can add, list, update, and delete webhooks.
          </div>
        </Card>
      );
    },
    []
  );

  const fetchErrorPlaceHolder = useMemo(
    () => (message: string) => {
      return (
        <ErrorPlaceHolder>
          <p className="tw-text-center">{message}</p>
          <p className="tw-text-center">
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                className={classNames('tw-h-8 tw-rounded tw-my-3', {
                  'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                })}
                data-testid="add-webhook-button"
                size="small"
                theme="primary"
                variant="contained"
                onClick={onAddWebhook}>
                Add Webhook
              </Button>
            </NonAdminAction>
          </p>
        </ErrorPlaceHolder>
      );
    },
    []
  );

  useEffect(() => {
    setFilteredData(getFilteredWebhooks());
  }, [data, selectedStatus]);

  if (data.length === 0) {
    return fetchErrorPlaceHolder('No webhooks found');
  }

  return (
    <Space align="start" className="tw-w-full webhook-page-container" size={20}>
      <div className="tw-w-full">
        <div className="tw-flex tw-items-center tw-justify-between">
          <Select
            bordered={false}
            className="tw-min-w-64 tw-text-body webhook-filter-select"
            mode="multiple"
            options={statuses}
            placeholder="Filter by status"
            onChange={onStatusFilter}
          />
          {filteredData.length > 0 && (
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                  'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                })}
                data-testid="add-webhook-button"
                size="small"
                theme="primary"
                variant="contained"
                onClick={onAddWebhook}>
                Add Webhook
              </Button>
            </NonAdminAction>
          )}
        </div>
        {filteredData.length ? (
          <>
            {filteredData.map((webhook, index) => (
              <div className="tw-mb-3" key={index}>
                <WebhookDataCard
                  description={webhook.description}
                  endpoint={webhook.endpoint}
                  name={webhook.name}
                  status={webhook.status}
                  onClick={onClickWebhook}
                />
              </div>
            ))}
            {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
              <NextPrevious
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                paging={paging}
                pagingHandler={onPageChange}
                totalCount={paging.total}
              />
            )}
          </>
        ) : (
          fetchErrorPlaceHolder('No webhooks found for applied filters')
        )}
      </div>
      <div className="webhook-right-panel">{fetchRightPanel()}</div>
    </Space>
  );
};

export default WebhooksV1;
