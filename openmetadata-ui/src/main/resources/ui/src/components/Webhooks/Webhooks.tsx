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
import { isNil, startCase } from 'lodash';
import React, { FunctionComponent, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Status, Webhook } from '../../generated/entity/events/webhook';
import { useAuth } from '../../hooks/authHooks';
import { getDocButton } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import WebhookDataCard from '../common/webhook-data-card/WebhookDataCard';
import PageLayout from '../containers/PageLayout';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { WebhooksProps } from './Webhooks.interface';

const statuses = [
  {
    name: startCase(Status.NotStarted),
    value: Status.NotStarted,
  },
  {
    name: startCase(Status.Started),
    value: Status.Started,
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
  onAddWebhook,
  onDeleteWebhook,
  onEditWebhook,
  onPageChange,
}: WebhooksProps) => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [deleteData, setDeleteData] = useState<Webhook>();

  const handleDelete = () => {
    if (deleteData) {
      onDeleteWebhook(deleteData.id);
    }
    setDeleteData(undefined);
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
                  className="tw-mr-1 custom-checkbox"
                  data-testid="checkbox"
                  type="checkbox"
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
          Webhook allow external services to be notified when certain events
          happen. When the special event happen, we’ll send a POST request to
          each of the URLs you provide. Learn more in our Webhooks Guide .
        </div>
        {getDocButton('Webhooks Guide', '', 'webhook-doc')}
      </>
    );
  };

  return (
    <PageLayout leftPanel={fetchLeftPanel()} rightPanel={fetchRightPanel()}>
      <div className="">
        <div className="tw-flex tw-justify-end tw-items-center">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
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
        {data.map((webhook, index) => (
          <div className="tw-mb-3" key={index}>
            <WebhookDataCard
              description={webhook.description}
              endpoint={webhook.endpoint}
              name={webhook.name}
              status={webhook.status}
              onDelete={() => {
                setDeleteData(webhook);
              }}
              onEdit={() => {
                onEditWebhook(webhook.name);
              }}
            />
          </div>
        ))}
        {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
          <NextPrevious paging={paging} pagingHandler={onPageChange} />
        )}
        {deleteData && (
          <ConfirmationModal
            bodyText={`You want to delete webhook ${deleteData.name} permanently? This action cannot be reverted.`}
            cancelText="Discard"
            confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
            confirmText="Delete"
            header="Are you sure?"
            onCancel={() => setDeleteData(undefined)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Webhooks;
