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

import {
  Box,
  EmptyPlaceholder,
  Table,
  TableCard,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  Bell01,
  MarkerPin01,
  Plus,
  ZapFast,
} from '@untitledui/icons';
import { Button } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import RichTextEditorPreviewerNew from '../../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ALERT_TABLE_COLUMN_IDS } from '../ObservabilityAlertsPage.constants';
import { ObservabilityAlertsTableProps } from '../ObservabilityAlertsPage.interface';
import {
  getAlertTableCellLayoutClassName,
  getAlertTableHeaderLayoutClassName,
} from '../ObservabilityAlertsPage.utils';
import ObservabilityAlertActions from './ObservabilityAlertActions';

function ObservabilityAlertsTable({
  alertPermissions,
  alertResourcePermission,
  hasResourcePermissionError,
  alerts,
  columnList,
  currentPage,
  getAlertDetailsPath,
  loading,
  loadingCount,
  onAddAlert,
  onEditAlert,
  onPageChange,
  onPageSizeChange,
  onRetryPermission,
  onSelectAlert,
  onViewAlert,
  paging,
  pageSize,
  showPagination,
}: Readonly<ObservabilityAlertsTableProps>) {
  const { t } = useTranslation();

  // Fail closed: only show the create CTA when create is explicitly allowed. If
  // the resource-permission fetch fails (undefined), the CTA stays hidden rather
  // than optimistically exposing a privileged action; useObservabilityAlerts
  // surfaces an error toast so the user can refresh to retry.
  const hasCreatePermission = Boolean(
    alertResourcePermission?.Create || alertResourcePermission?.All
  );

  const emptyStateFeatures = useMemo(
    () => [
      {
        key: 'trigger',
        icon: <ZapFast className="tw:text-fg-brand-primary" />,
        title: t('label.pick-a-trigger'),
        description: t('message.alert-pick-a-trigger-description'),
      },
      {
        key: 'destination',
        icon: <MarkerPin01 className="tw:text-fg-warning-primary" />,
        title: t('label.choose-the-destination'),
        description: t('message.alert-choose-destination-description'),
      },
      {
        key: 'stay-ahead',
        icon: <Bell01 className="tw:text-fg-success-primary" />,
        title: t('label.stay-ahead'),
        description: t('message.alert-stay-ahead-description'),
      },
    ],
    [t]
  );

  const renderRow = (record: EventSubscription) => {
    const alertPermission = alertPermissions?.find(
      (alert) => alert.id === record.id
    );
    const alertName = getEntityName(record);
    const alertFqn = record.fullyQualifiedName ?? '';

    return (
      <Table.Row data-row-key={record.id} id={record.id} key={record.id}>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.NAME
          )}>
          {onViewAlert ? (
            <Button
              className="tw:h-auto tw:p-0"
              data-testid="alert-name"
              type="link"
              onClick={() => onViewAlert(record)}>
              {alertName}
            </Button>
          ) : (
            <Link data-testid="alert-name" to={getAlertDetailsPath(alertFqn)}>
              {alertName}
            </Link>
          )}
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.TRIGGER
          )}>
          {record.filteringRules?.resources?.join(', ') || '--'}
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.DESCRIPTION
          )}>
          <RichTextEditorPreviewerNew markdown={record.description ?? ''} />
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.ACTIONS
          )}>
          <div className="tw:flex tw:h-full tw:items-start">
            <ObservabilityAlertActions
              alertPermission={alertPermission}
              loading={loadingCount > 0}
              record={record}
              onEditAlert={onEditAlert}
              onSelectAlert={onSelectAlert}
            />
          </div>
        </Table.Cell>
      </Table.Row>
    );
  };

  // Hold the empty state until the alerts request AND the resource-permission
  // fetch (tracked by loadingCount) have both settled. Otherwise an empty
  // alerts response can render the onboarding before alertResourcePermission
  // resolves, hiding the "New Alert" CTA from an authorized user.
  const isAlertsEmpty = !loading && loadingCount === 0 && alerts.length === 0;

  const emptyStatePlaceholder = (
    <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
      <EmptyPlaceholder
        actions={
          hasCreatePermission
            ? [
                {
                  key: 'new-alert',
                  label: t('label.new-entity', {
                    entity: t('label.alert'),
                  }),
                  color: 'primary' as const,
                  iconLeading: Plus,
                  onPress: onAddAlert,
                },
              ]
            : undefined
        }
        description={t('message.observability-alert-empty-description')}
        features={emptyStateFeatures}
        title={t('message.observability-alert-empty-heading')}
        variant="features"
      />
    </Box>
  );

  // When the resource-permission fetch failed we can't tell allow from deny, and
  // showErrorToast suppresses its 401/403 — so show an explicit error + retry
  // cue instead of the create-less onboarding.
  const errorStatePlaceholder = (
    <Box className="tw:relative tw:min-h-[calc(100vh_-_16rem)] tw:w-full">
      <EmptyPlaceholder
        actions={
          onRetryPermission
            ? [
                {
                  key: 'retry',
                  label: t('label.try-again'),
                  color: 'primary' as const,
                  onPress: onRetryPermission,
                },
              ]
            : undefined
        }
        description={t('server.unexpected-error')}
        icon={<AlertTriangle className="tw:text-fg-error-primary" />}
        title={t('message.something-went-wrong')}
        variant="blank"
      />
    </Box>
  );

  return (
    <TableCard.Root className="tw:rounded-xl tw:border tw:border-secondary tw:shadow-none tw:ring-0">
      {isAlertsEmpty ? (
        hasResourcePermissionError ? (
          errorStatePlaceholder
        ) : (
          emptyStatePlaceholder
        )
      ) : (
        <>
          <div className="tw:border-b tw:border-secondary">
            <Table
              aria-label={t('label.observability-alert')}
              data-testid="alert-table">
              <Table.Header columns={columnList}>
                {(col) => (
                  <Table.Head
                    className={getAlertTableHeaderLayoutClassName(col.id)}
                    id={col.id}
                    key={col.id}
                    label={col.name}
                  />
                )}
              </Table.Header>
              <Table.Body
                dependencies={[loadingCount, alertPermissions]}
                items={loading ? [] : alerts}
                renderEmptyState={() => <></>}>
                {(record) => renderRow(record as EventSubscription)}
              </Table.Body>
            </Table>
          </div>
          {showPagination && (
            <div className="tw:py-3">
              <NextPrevious
                currentPage={currentPage}
                isLoading={loading}
                pageSize={pageSize}
                paging={paging}
                pagingHandler={onPageChange}
                onShowSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </>
      )}
    </TableCard.Root>
  );
}

export default ObservabilityAlertsTable;
