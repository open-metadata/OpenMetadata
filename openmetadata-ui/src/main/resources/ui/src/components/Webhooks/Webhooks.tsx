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

import classNames from 'classnames';
import { cloneDeep, isNil, startCase } from 'lodash';
import React, { FunctionComponent, useEffect, useState } from 'react';
import {
  PAGE_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { Status, Webhook } from '../../generated/entity/events/webhook';
import { useAuth } from '../../hooks/authHooks';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import WebhookDataCard from '../common/webhook-data-card/WebhookDataCard';
import PageLayout from '../containers/PageLayout';
import { WebhooksProps } from './Webhooks.interface';

const statuses = [
  {
    name: startCase(Status.Disabled),
    value: Status.Disabled,
  },
  {
    name: startCase(Status.Active),
    value: Status.Active,
  },
  {
    name: startCase(Status.Failed),
    value: Status.Failed,
  },
  {
    name: startCase(Status.AwaitingRetry),
    value: Status.AwaitingRetry,
  },
  {
    name: startCase(Status.RetryLimitReached),
    value: Status.RetryLimitReached,
  },
];

const Webhooks: FunctionComponent<WebhooksProps> = ({
  data = [],
  paging,
  selectedStatus = [],
  onAddWebhook,
  onClickWebhook,
  onPageChange,
  onStatusFilter,
  currentPage,
}: WebhooksProps) => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [filteredData, setFilteredData] = useState<Array<Webhook>>(data);

  const getFilteredWebhooks = () => {
    return selectedStatus.length
      ? data.filter(
          (item) => item.status && selectedStatus.includes(item.status)
        )
      : data;
  };

  const handleStatusSelection = (status: Status) => {
    const arrStatus = cloneDeep(selectedStatus);
    if (arrStatus.includes(status)) {
      const index = arrStatus.indexOf(status);
      arrStatus.splice(index, 1);
    } else {
      arrStatus.push(status);
    }

    onStatusFilter(arrStatus);
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Webhooks</h6>
        <div className="tw-flex tw-justify-between tw-flex-col">
          <h6 className="tw-heading tw-mb-0" data-testid="filter-heading">
            Status
          </h6>
          <div className="tw-flex tw-mt-2" />
        </div>
        <div
          className="sidebar-my-data-holder"
          data-testid="filter-containers-1">
          {statuses.map((statusType, index) => (
            <div
              className="filter-group tw-justify-between tw-mb-3"
              data-testid={`status-type-${statusType.value}`}
              key={index}>
              <div className="tw-flex">
                <input
                  checked={selectedStatus.includes(statusType.value)}
                  className="tw-mr-1 custom-checkbox"
                  data-testid="checkbox"
                  type="checkbox"
                  onChange={() => {
                    handleStatusSelection(statusType.value);
                  }}
                />
                <div
                  className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                  data-testid="checkbox-label">
                  <div className="tw-ml-1">{statusType.name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const fetchRightPanel = () => {
    return (
      <>
        <div className="tw-mb-5 tw-mt-11">
          The webhook allows external services to be notified of the metadata
          change events happening in your organization through APIs. Register
          callback URLs with webhook integration to receive metadata event
          notifications. You can add, list, update, and delete webhooks.
        </div>
      </>
    );
  };

  const fetchErrorPlaceHolder = (message: string) => {
    return (
      <ErrorPlaceHolder>
        <p className="tw-text-center">{message}</p>
        <p className="tw-text-center">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
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
  };

  useEffect(() => {
    setFilteredData(getFilteredWebhooks());
  }, [data, selectedStatus]);

  return data.length ? (
    <PageLayout leftPanel={fetchLeftPanel()} rightPanel={fetchRightPanel()}>
      <div>
        {filteredData.length ? (
          <>
            <div className="tw-flex tw-justify-end tw-items-center">
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
            </div>
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
    </PageLayout>
  ) : (
    <PageLayout>{fetchErrorPlaceHolder('No webhooks found')}</PageLayout>
  );
};

export default Webhooks;
