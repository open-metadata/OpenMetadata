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
import { Button, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useDataAccessRequest } from '../../../hooks/useDataAccessRequest';
import {
  listDataAccessRequests,
  TaskEntityStatus,
  TaskStatusGroup,
} from '../../../rest/tasksAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import tableClassBase from '../../../utils/TableClassBase';
import { getDarButtonTooltip } from '../../../utils/TasksUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './data-access-widget.less';

interface DataAccessEntity extends Omit<EntityReference, 'type'> {
  owners?: EntityReference[];
  deleted?: boolean;
}

interface AccessCounts {
  pending: number;
  approved: number;
  denied: number;
}

type UserAccessStatus = 'none' | 'pending' | 'approved' | 'denied';

const DataAccessWidget = () => {
  const { t } = useTranslation();
  const { data, type } = useGenericContext<DataAccessEntity>();
  const entityType = type as EntityType;
  const enabled =
    entityType === EntityType.TABLE &&
    !data.deleted &&
    Boolean(data.fullyQualifiedName);
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<AccessCounts>({
    pending: 0,
    approved: 0,
    denied: 0,
  });

  const { isDarDisabled, isDarAwaitingGrant, isDarGranted, refetch } =
    useDataAccessRequest({
      entityFqn: data.fullyQualifiedName,
      enabled,
    });

  const fetchCounts = useCallback(async () => {
    if (!enabled || !data.fullyQualifiedName) {
      setCounts({ pending: 0, approved: 0, denied: 0 });

      return;
    }
    try {
      const [active, closed] = await Promise.all([
        listDataAccessRequests({
          dataset: data.fullyQualifiedName,
          statusGroup: TaskStatusGroup.Active,
          limit: 100,
        }),
        listDataAccessRequests({
          dataset: data.fullyQualifiedName,
          statusGroup: TaskStatusGroup.Closed,
          limit: 100,
        }),
      ]);
      const activeTasks = active.data ?? [];
      const closedTasks = closed.data ?? [];

      const pending = activeTasks.filter(
        (t) =>
          t.status !== TaskEntityStatus.Approved &&
          t.status !== TaskEntityStatus.Granted
      ).length;
      const approved =
        activeTasks.filter(
          (t) =>
            t.status === TaskEntityStatus.Approved ||
            t.status === TaskEntityStatus.Granted
        ).length +
        closedTasks.filter(
          (t) =>
            t.status === TaskEntityStatus.Approved ||
            t.status === TaskEntityStatus.Granted
        ).length;
      const denied = closedTasks.filter(
        (t) => t.status === TaskEntityStatus.Rejected
      ).length;
      setCounts({ pending, approved, denied });
    } catch {
      setCounts({ pending: 0, approved: 0, denied: 0 });
    }
  }, [enabled, data.fullyQualifiedName]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const userStatus = useMemo<UserAccessStatus>(() => {
    if (isDarGranted) {
      return 'approved';
    }
    if (isDarAwaitingGrant) {
      return 'pending';
    }
    if (isDarDisabled) {
      return 'pending';
    }

    return 'none';
  }, [isDarDisabled, isDarAwaitingGrant, isDarGranted]);

  if (!enabled) {
    return null;
  }

  const totalCount = counts.pending + counts.approved + counts.denied;
  const tooltipTitle = getDarButtonTooltip(
    isDarDisabled,
    isDarGranted,
    isDarAwaitingGrant,
    t
  );

  const renderUserBlock = () => {
    if (userStatus === 'pending') {
      return (
        <div className="data-access-widget__status-card data-access-widget__status-card--warning">
          <div className="data-access-widget__status-title">
            {t('label.data-access-request-awaiting-grant')}
          </div>
          <div className="data-access-widget__status-sub">
            {t('label.awaiting-approval')}
          </div>
        </div>
      );
    }
    if (userStatus === 'approved') {
      return (
        <div className="data-access-widget__status-card data-access-widget__status-card--success">
          <div className="data-access-widget__status-title">
            {t('label.you-have-access')}
          </div>
          <div className="data-access-widget__status-sub">
            {t('label.granted-by-data-steward')}
          </div>
        </div>
      );
    }

    return (
      <Tooltip title={tooltipTitle}>
        <Button
          block
          className="data-access-widget__cta"
          data-testid="data-access-request-button"
          disabled={isDarDisabled}
          type="primary"
          onClick={() => setIsOpen(true)}>
          <KeyIcon height={14} width={14} />
          {t('label.request-access')}
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className="data-access-widget" data-testid="data-access-widget">
      <div className="data-access-widget__header">
        <span className="data-access-widget__title">
          <span className="data-access-widget__title-icon">
            <KeyIcon height={13} width={13} />
          </span>
          {t('label.data-access')}
          <span
            className="data-access-widget__count"
            data-testid="data-access-count">
            {totalCount}
          </span>
        </span>
      </div>
      <div className="data-access-widget__body">
        <div className="data-access-widget__counts">
          <div className="data-access-widget__counts-col">
            <div className="data-access-widget__counts-label">
              <span className="data-access-widget__dot data-access-widget__dot--pending" />
              {t('label.pending')}
            </div>
            <div className="data-access-widget__counts-value data-access-widget__counts-value--pending">
              {counts.pending}
            </div>
          </div>
          <div className="data-access-widget__counts-col">
            <div className="data-access-widget__counts-label">
              <span className="data-access-widget__dot data-access-widget__dot--approved" />
              {t('label.approved')}
            </div>
            <div className="data-access-widget__counts-value data-access-widget__counts-value--approved">
              {counts.approved}
            </div>
          </div>
          <div className="data-access-widget__counts-col">
            <div className="data-access-widget__counts-label">
              <span className="data-access-widget__dot data-access-widget__dot--denied" />
              {t('label.denied')}
            </div>
            <div className="data-access-widget__counts-value">
              {counts.denied}
            </div>
          </div>
        </div>
        {renderUserBlock()}
      </div>
      {tableClassBase.getRequestDataAccessDrawer(
        isOpen,
        () => setIsOpen(false),
        data.fullyQualifiedName ?? '',
        getEntityName(data),
        entityType,
        refetch
      )}
    </div>
  );
};

export default DataAccessWidget;
