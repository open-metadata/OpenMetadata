/*
 *  Copyright 2026 Collate.
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

import { Badge, Tabs } from '@openmetadata/ui-core-components';
import { Empty, Skeleton } from 'antd';
import { ArrowRight } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import {
  DataAccessRequestPayload,
  listMyAssignedTasks,
  listMyCreatedTasks,
  Task,
  TaskCategory,
  TaskEntityType,
} from '../../../rest/tasksAPI';
import { getDisplayStatus } from '../../../utils/DataAccessRequest/DataAccessRequestUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import DataAccessRequestDetailDrawer from '../../DataAccessRequest/DataAccessRequestDetailDrawer/DataAccessRequestDetailDrawer.component';
import '../marketplace-widget-shared.less';

const DISPLAY_COUNT = 4;

const STATUS_BADGE_COLOR: Record<
  string,
  'success' | 'error' | 'warning' | 'gray' | 'orange'
> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'error',
  Revoked: 'orange',
  Expired: 'gray',
};

const filterDARTasks = (tasks: Task[]) =>
  tasks.filter(
    (t) =>
      t.category === TaskCategory.DataAccess &&
      t.type === TaskEntityType.DataAccessRequest
  );

const formatShortDate = (timestamp?: number): string => {
  if (!timestamp) {
    return '--';
  }
  const d = new Date(timestamp);

  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${d.getFullYear()}`;
};

interface SectionProps {
  titleKey: string;
  emptyKey: string;
  items: Task[];
  viewAllTab: 'my-requests' | 'my-approvals';
  onSelect: (task: Task) => void;
  showApprover?: boolean;
}

const Section = ({
  titleKey,
  emptyKey,
  items,
  viewAllTab,
  onSelect,
  showApprover,
}: SectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:text-sm tw:font-medium tw:text-(--color-text-primary)">
            {t(titleKey)}
          </span>
          {items.length > 0 && (
            <span className="tw:inline-flex tw:items-center tw:px-1.5 tw:py-0.5 tw:rounded tw:bg-(--color-bg-primary) tw:border tw:border-(--color-border-secondary) tw:text-xs tw:text-(--color-text-secondary)">
              {items.length}
            </span>
          )}
        </div>
        <Link
          className="tw:text-sm tw:font-medium tw:text-(--color-text-brand-primary) tw:flex tw:items-center tw:gap-1"
          data-testid={`marketplace-dar-view-all-${viewAllTab}`}
          to={`${ROUTES.DATA_ACCESS_REQUESTS}/${viewAllTab}`}>
          {t('label.view-all')}
          {items.length > 0 ? ` (${items.length})` : ''}
          <ArrowRight className="tw:w-3.5 tw:h-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <Empty
          description={t(emptyKey)}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className="tw:flex tw:flex-col tw:gap-2">
          {items.map((task) => {
            const payload = task.payload as
              | DataAccessRequestPayload
              | undefined;
            const display = getDisplayStatus(task);
            const badgeColor = STATUS_BADGE_COLOR[display] ?? 'gray';
            const userRef = showApprover
              ? task.resolution?.resolvedBy ?? task.reviewers?.[0] ?? task.createdBy
              : task.createdBy;

            return (
              <button
                className="tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3 tw:bg-(--color-bg-primary) tw:rounded-md tw:cursor-pointer hover:tw:bg-(--color-bg-secondary) tw:text-left tw:w-full tw:transition-colors"
                data-testid={`marketplace-dar-row-${task.taskId}`}
                key={task.id}
                style={{
                  boxShadow: '0 0 10px 0 rgba(21, 17, 68, 0.06)',
                }}
                type="button"
                onClick={() => onSelect(task)}>
                <div className="tw:flex tw:flex-col tw:flex-1 tw:min-w-0 tw:gap-1">
                  <div className="tw:flex tw:items-center tw:gap-3 tw:flex-wrap">
                    <span className="tw:text-sm tw:font-medium tw:text-(--color-text-brand-primary)">
                      {task.taskId}
                    </span>
                    <span className="tw:text-xs tw:text-(--color-text-secondary)">
                      {t('label.requested-on')}:{' '}
                      <span className="tw:text-(--color-text-primary)">
                        {formatShortDate(task.createdAt)}
                      </span>
                    </span>
                    {payload?.accessType && (
                      <span className="tw:text-xs tw:text-(--color-text-secondary)">
                        {t('label.access-type')}:{' '}
                        <span className="tw:text-(--color-text-primary)">
                          {payload.accessType}
                        </span>
                      </span>
                    )}
                    <span className="tw:text-xs tw:text-(--color-text-secondary) tw:flex tw:items-center tw:gap-1">
                      {showApprover
                        ? t('label.requested-by')
                        : t('label.approver')}
                      :
                      {userRef ? (
                        <span className="tw:flex tw:items-center tw:gap-1 tw:text-(--color-text-primary)">
                          <ProfilePicture
                            displayName={userRef.displayName ?? ''}
                            name={userRef.name ?? ''}
                            size={16}
                          />
                          {getEntityName(userRef)}
                        </span>
                      ) : (
                        '--'
                      )}
                    </span>
                  </div>
                  <span className="tw:text-xs tw:text-(--color-text-tertiary) tw:truncate">
                    {task.about?.displayName ??
                      task.about?.name ??
                      task.about?.fullyQualifiedName ??
                      '--'}
                  </span>
                </div>
                <Badge color={badgeColor} size="sm" type="color">
                  {display}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MarketplaceDataAccessRequestsWidget = ({
  isEditView,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<Task[]>([]);
  const [loading, setLoading] = useState(!isEditView);
  const [activeTab, setActiveTab] = useState<'my-requests' | 'my-approvals'>(
    'my-requests'
  );
  const [detailTaskId, setDetailTaskId] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    if (isEditView) {
      return;
    }
    try {
      setLoading(true);
      const [created, assigned] = await Promise.all([
        listMyCreatedTasks({
          fields: 'about,resolution,createdBy,reviewers',
          limit: 25,
        }),
        listMyAssignedTasks({
          fields: 'about,resolution,createdBy,reviewers',
          limit: 25,
        }),
      ]);
      setRequests(filterDARTasks(created.data ?? []).slice(0, DISPLAY_COUNT));
      setApprovals(filterDARTasks(assigned.data ?? []).slice(0, DISPLAY_COUNT));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [isEditView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabContent = useMemo(() => {
    if (activeTab === 'my-requests') {
      return (
        <Section
          emptyKey="message.no-data-access-request-by-me"
          items={requests}
          titleKey="label.data-access-request"
          viewAllTab="my-requests"
          onSelect={(t) => setDetailTaskId(t.id)}
        />
      );
    }

    return (
      <Section
        emptyKey="message.no-data-access-request-pending-approval"
        items={approvals}
        showApprover
        titleKey="label.data-access-request"
        viewAllTab="my-approvals"
        onSelect={(t) => setDetailTaskId(t.id)}
      />
    );
  }, [activeTab, requests, approvals]);

  return (
    <>
      <div
        className="tw:bg-(--color-bg-primary) tw:rounded-xl tw:border tw:border-(--color-border-secondary) tw:p-4 tw:flex tw:flex-col tw:gap-4"
        data-testid="marketplace-dar-widget">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) =>
            setActiveTab(String(key) as 'my-requests' | 'my-approvals')
          }>
          <Tabs.List size="sm" type="button-gray">
            <Tabs.Item id="my-requests">
              <span className="tw:flex tw:items-center tw:gap-2">
                {t('label.my-request-plural')}
                <span className="tw:inline-flex tw:items-center tw:px-1.5 tw:py-0.5 tw:rounded-full tw:bg-(--color-bg-secondary) tw:border tw:border-(--color-border-secondary) tw:text-xs">
                  {requests.length}
                </span>
              </span>
            </Tabs.Item>
            <Tabs.Item id="my-approvals">
              <span className="tw:flex tw:items-center tw:gap-2">
                {t('label.my-pending-approval-plural')}
                <span className="tw:inline-flex tw:items-center tw:px-1.5 tw:py-0.5 tw:rounded-full tw:bg-(--color-bg-secondary) tw:border tw:border-(--color-border-secondary) tw:text-xs">
                  {approvals.length}
                </span>
              </span>
            </Tabs.Item>
          </Tabs.List>
        </Tabs>

        {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : tabContent}
      </div>

      <DataAccessRequestDetailDrawer
        open={Boolean(detailTaskId)}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(undefined)}
        onResolved={() => {
          setDetailTaskId(undefined);
          fetchData();
        }}
      />
    </>
  );
};

export default MarketplaceDataAccessRequestsWidget;
