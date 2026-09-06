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
  Button,
  EmptyPlaceholder,
  PaginationCardWithControls,
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
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import RichTextEditorPreviewerNew from '../../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { CursorType } from '../../../enums/pagination.enum';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { Paging } from '../../../generated/type/paging';
import {
  AlertTableColumn,
  AlertTableColumnId,
  ALERT_TABLE_COLUMN_IDS,
} from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.constants';
import { AlertPermission } from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.interface';
import {
  getAlertTableCellLayoutClassName,
  getAlertTableHeaderLayoutClassName,
} from '../../../pages/ObservabilityAlertsPage/ObservabilityAlertsPage.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { computeTotalPages } from '../../../utils/PaginationUtils';
import ObservabilityAlertAiActions from './ObservabilityAlertAiActions.component';

interface ObservabilityAlertsAiPageChangeParams {
  cursorType?: CursorType;
  currentPage: number;
}

const PAGE_SIZE_OPTIONS = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE];
// max-width: 0 lets the link truncate inside the fixed table layout instead
// of forcing the name column wider than its 30% allocation.
const ALERT_NAME_COLUMN_LAYOUT_CLASS = 'tw:w-[30%]! tw:max-w-0';

interface ObservabilityAlertsAiTableProps {
  alertPermissions?: AlertPermission[];
  alertResourcePermission?: OperationPermission;
  hasResourcePermissionError?: boolean;
  alerts: EventSubscription[];
  columnList: AlertTableColumn[];
  currentPage: number;
  getAlertDetailsPath: (fqn: string) => string;
  loading: boolean;
  loadingCount: number;
  onAddAlert: () => void;
  onEditAlert?: (alert: EventSubscription) => void;
  onPageChange: (params: ObservabilityAlertsAiPageChangeParams) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRetryPermission?: () => void;
  onSelectAlert: (alert: EventSubscription) => void;
  onViewAlert?: (alert: EventSubscription) => void;
  pageSize: number;
  paging: Paging;
  showPagination: boolean;
}

function ObservabilityAlertsAiTable({
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
}: Readonly<ObservabilityAlertsAiTableProps>) {
  const { t } = useTranslation();
  const totalPages = computeTotalPages(pageSize, paging.total);
  const displayTotalPages = Math.max(
    totalPages,
    currentPage + (paging.after ? 1 : 0),
    currentPage
  );
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

  const handlePageChange = (nextPage: number) => {
    if (nextPage === currentPage) {
      return;
    }

    onPageChange({
      cursorType: nextPage > currentPage ? CursorType.AFTER : CursorType.BEFORE,
      currentPage: nextPage > currentPage ? currentPage + 1 : currentPage - 1,
    });
  };

  const renderRow = (record: EventSubscription) => {
    const alertPermission = alertPermissions?.find(
      (alert) => alert.id === record.id
    );
    const alertName = getEntityName(record);
    const alertFqn = record.fullyQualifiedName ?? '';

    return (
      <Table.Row data-row-key={record.id} id={record.id} key={record.id}>
        <Table.Cell
          className={classNames(
            getAlertTableCellLayoutClassName(ALERT_TABLE_COLUMN_IDS.NAME),
            ALERT_NAME_COLUMN_LAYOUT_CLASS
          )}>
          {onViewAlert ? (
            <Button
              className="tw:block tw:min-w-0 tw:truncate"
              color="link-color"
              data-testid="alert-name"
              size="sm"
              title={alertName}
              onPress={() => onViewAlert(record)}>
              {alertName}
            </Button>
          ) : (
            <Link
              className="tw:block tw:min-w-0 tw:truncate"
              data-testid="alert-name"
              title={alertName}
              to={getAlertDetailsPath(alertFqn)}>
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
            <ObservabilityAlertAiActions
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

  const isAlertsEmpty = !loading && alerts.length === 0;

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

  const alertsEmptyPlaceholder = hasResourcePermissionError
    ? errorStatePlaceholder
    : emptyStatePlaceholder;

  return (
    <TableCard.Root className="tw:rounded-xl tw:border tw:border-secondary tw:shadow-none tw:outline-0">
      {isAlertsEmpty ? (
        alertsEmptyPlaceholder
      ) : (
        <>
          <div className="tw:border-b tw:border-secondary">
            <Table
              aria-label={t('label.observability-alert')}
              data-testid="alert-table">
              <Table.Header columns={columnList}>
                {(col) => (
                  <Table.Head
                    className={classNames(
                      getAlertTableHeaderLayoutClassName(
                        col.id as AlertTableColumnId
                      ),
                      col.id === ALERT_TABLE_COLUMN_IDS.NAME &&
                        ALERT_NAME_COLUMN_LAYOUT_CLASS
                    )}
                    id={col.id}
                    key={col.id}
                    label={col.name}
                  />
                )}
              </Table.Header>
              <Table.Body
                dependencies={[loadingCount, alertPermissions]}
                items={loading ? [] : alerts}
                renderEmptyState={() => null}>
                {(record) => renderRow(record as EventSubscription)}
              </Table.Body>
            </Table>
          </div>
          {showPagination && (
            <PaginationCardWithControls
              className={classNames(
                'tw:border-0!',
                loading && 'tw:pointer-events-none tw:opacity-60'
              )}
              page={currentPage}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              total={displayTotalPages}
              onPageChange={handlePageChange}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </>
      )}
    </TableCard.Root>
  );
}

export default ObservabilityAlertsAiTable;
